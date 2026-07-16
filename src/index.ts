import dotenv from "dotenv";


dotenv.config();
import app from "./app";
import prisma from "./config/db";

// Basic environment variable checks
if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is missing in environment variables");
  process.exit(1);
}

if (!process.env.JWT_SECRET) {
  console.error("JWT_SECRET is missing in environment variables");
  process.exit(1);
}

const PORT = process.env.PORT || 5000;

async function startServer() {
  try {
    // Validate database connection
    console.log("Connecting to the database...");
    await prisma.$connect();
    console.log("Database connected successfully.");

    // Start listening
    app.listen(PORT, () => {
      console.log(`[Server]: Quanta Finance Server is running on port ${PORT}`);
    });
  } catch (error) {
    console.error("Failed to start the server:", error);
    process.exit(1);
  }
}

// Handle process termination cleanly
process.on("SIGINT", async () => {
  await prisma.$disconnect();
  console.log("Database connection closed. Exiting server.");
  process.exit(0);
});

startServer();
