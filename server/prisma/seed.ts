import { PrismaClient, Role } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function upsertUser(email: string, name: string, password: string, role: Role) {
  const passwordHash = await bcrypt.hash(password, 12);
  await prisma.user.upsert({
    where: { email },
    update: { name, passwordHash, role },
    create: { email, name, passwordHash, role },
  });
  console.log(`Seeded ${role.toLowerCase()}: ${email}`);
}

async function main() {
  const adminEmail = process.env.ADMIN_EMAIL ?? "admin@rentsystem.local";
  const adminPassword = process.env.ADMIN_PASSWORD ?? "admin12345";
  await upsertUser(adminEmail, "Admin", adminPassword, Role.ADMIN);

  // Demo accounts for local development only.
  if (process.env.NODE_ENV !== "production") {
    await upsertUser("landlord@rentsystem.local", "Demo Landlord", "landlord12345", Role.LANDLORD);
    await upsertUser("tenant@rentsystem.local", "Demo Tenant", "tenant12345", Role.TENANT);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
