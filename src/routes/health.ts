import { Router, Request, Response } from "express";
import prisma from "../config/db";

const router = Router();

router.get("/health", async (_req: Request, res: Response) => {
  try {
    // Check database connection by performing a simple query
    await prisma.user.count();
    
    res.status(200).json({
      status: "ok",
      service: "Quanta Finance Backend",
      database: "connected",
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    res.status(500).json({
      status: "error",
      service: "Quanta Finance Backend",
      database: "disconnected",
      error: error.message || "Database connection check failed",
      timestamp: new Date().toISOString()
    });
  }
});

export default router;
