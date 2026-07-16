/**
 * seed-admin.ts
 * Run this ONCE to create an admin user in the database.
 * Usage: npx ts-node src/seed-admin.ts
 */

import dotenv from "dotenv";
import path from "path";
dotenv.config({ path: path.join(__dirname, "../.env") });

import prisma from "./config/db";
import bcrypt from "bcryptjs";

async function seedAdmin() {
  const email = "admin@quantabank.com";
  const password = "AdminPass@123";

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    console.log("✅ Admin user already exists:", email);
    await prisma.$disconnect();
    return;
  }

  const passwordHash = await bcrypt.hash(password, 12);

  const admin = await prisma.user.create({
    data: {
      firstName: "Quanta",
      lastName: "Admin",
      email,
      passwordHash,
      role: "admin",
      status: "active",
    },
  });

  console.log("🎉 Admin user created successfully!");
  console.log("   Email   :", admin.email);
  console.log("   Password:", password);
  console.log("   Role    :", admin.role);
  console.log("\n⚠️  Change this password immediately in production!");

  await prisma.$disconnect();
}

seedAdmin().catch((e) => {
  console.error("Seed failed:", e);
  process.exit(1);
});
