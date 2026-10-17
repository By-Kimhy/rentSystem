#!/bin/bash
# Gets a Claude Code cloud session ready to run the app, lint and tests: MySQL 8 running with
# the `rent` user and `rentsystem` database, .env in place, packages installed, migrations
# applied and demo accounts seeded. Safe to run more than once. It doesn't start the dev server.
set -euo pipefail

if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

cd "$CLAUDE_PROJECT_DIR"

# MySQL from apt (Docker Hub pulls are rate-limited in cloud sessions).
if ! command -v mysqld >/dev/null 2>&1; then
  export DEBIAN_FRONTEND=noninteractive
  apt-get update -qq
  apt-get install -y -qq mysql-server >/dev/null
fi
if ! mysqladmin ping --silent >/dev/null 2>&1; then
  service mysql start >/dev/null 2>&1 || true
  for _ in $(seq 1 30); do
    mysqladmin ping --silent >/dev/null 2>&1 && break
    sleep 1
  done
fi
mysqladmin ping --silent

# The rent user needs global rights so `prisma migrate dev` can create its shadow database.
mysql -u root <<'SQL'
CREATE DATABASE IF NOT EXISTS rentsystem;
CREATE USER IF NOT EXISTS 'rent'@'localhost' IDENTIFIED BY 'rent';
CREATE USER IF NOT EXISTS 'rent'@'%' IDENTIFIED BY 'rent';
GRANT ALL ON *.* TO 'rent'@'localhost';
GRANT ALL ON *.* TO 'rent'@'%';
FLUSH PRIVILEGES;
SQL

if [ ! -f .env ]; then
  cp .env.example .env
  sed -i "s|^SESSION_SECRET=.*|SESSION_SECRET=\"$(openssl rand -base64 32)\"|" .env
fi

npm install --no-audit --no-fund
npm run db:deploy
npm run db:seed
