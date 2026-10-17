# One image for the whole app. docker-compose.yml runs it as the API, the web app, the
# migration step and the daily billing job, each with its own command.

# The full (not -slim) image, because Prisma's query engine needs OpenSSL, which -slim lacks.
FROM node:22-bookworm
WORKDIR /app

# Dependencies first, so they're cached until the lockfile changes. The Prisma schema is needed
# here because installing runs `prisma generate`. Dev dependencies stay: the migration and seed
# commands use prisma, tsx and dotenv-cli.
COPY package.json package-lock.json ./
COPY server/package.json server/
COPY server/prisma server/prisma
RUN npm ci --no-audit --no-fund && npm cache clean --force

COPY . .
# Next.js fixes the target of the /api rewrite at build time, so this must name the API service.
ARG API_URL=http://api:4000
ENV API_URL=$API_URL NEXT_TELEMETRY_DISABLED=1
# The build cache is only for rebuilding, not for running.
RUN npm run build && rm -rf .next/cache

ENV NODE_ENV=production UPLOAD_DIR=/data/uploads
RUN mkdir -p /data/uploads && chown -R node:node /data /app/.next
USER node
EXPOSE 3000 4000
CMD ["npm", "run", "start:web"]
