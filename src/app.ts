import express, { Express, Request, Response, NextFunction } from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import morgan from "morgan";
import path from "path";
import cookieParser from "cookie-parser";
import { sanitizeInputs } from "./middleware/sanitize";

import healthRouter from "./routes/health";
import authRouter from "./routes/auth";
import accountRouter from "./routes/account";
import transactionRouter from "./routes/transaction";
import cardRouter from "./routes/card";
import adminRouter from "./routes/admin";
import beneficiaryRouter from "./routes/beneficiary";
import analyticsRouter from "./routes/analytics";
import loanRouter from "./routes/loan";
import fdRouter from "./routes/fd";

const app: Express = express();

// Disable x-powered-by header to prevent fingerprinting
app.disable("x-powered-by");

// HTTP request logger
app.use(morgan("dev"));

// Serve uploaded profile pictures
app.use("/uploads", express.static(path.join(process.cwd(), "uploads")));

// Secure cookies parser
app.use(cookieParser(process.env.JWT_SECRET || "quanta_secret_key"));

// Body parsing
app.use(express.json({ limit: "10kb" })); // Max body size limit (prevent large payload DoS)
app.use(express.urlencoded({ extended: true, limit: "10kb" }));

// XSS and Path Traversal Input Sanitization
app.use(sanitizeInputs);

// Helmet Configuration - Anti Clickjacking, Anti MIME Sniffing, and Strict CSP
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'"],
        styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
        fontSrc: ["'self'", "https://fonts.gstatic.com"],
        imgSrc: ["'self'", "data:", "http://localhost:5000", "https://localhost:5000"],
        frameAncestors: ["'self'"], // Block Clickjacking
      },
    },
    crossOriginEmbedderPolicy: false,
  })
);

// Brute Force & Credential Stuffing rate limits for sensitive endpoints
const authLimiter = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 minutes
  max: 10,                  // max 10 requests per window
  message: {
    status: "error",
    message: "Too many login/verification attempts from this IP. Try again in 10 minutes."
  }
});
app.use("/api/v1/auth/login", authLimiter);
app.use("/api/v1/auth/forgot-password", authLimiter);
app.use("/api/v1/auth/reset-password", authLimiter);

// General rate limiter
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 150,
  message: {
    status: "error",
    message: "Too many requests from this IP, please try again after 15 minutes."
  }
});
app.use(generalLimiter);

// Configure CORS
const allowedOrigins = [
  "http://localhost:5173",
  "http://localhost:5174",
  "https://localhost:5173",
  "https://localhost:5174",
];

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      return callback(new Error("Not allowed by CORS"));
    },
    credentials: true,
  })
);

// Mount API routes
app.use("/api/v1", healthRouter);
app.use("/api/v1/auth", authRouter);
app.use("/api/v1/accounts", accountRouter);
app.use("/api/v1/transactions", transactionRouter);
app.use("/api/v1/cards", cardRouter);
app.use("/api/v1/admin", adminRouter);
app.use("/api/v1/beneficiaries", beneficiaryRouter);
app.use("/api/v1/analytics", analyticsRouter);
app.use("/api/v1/loans", loanRouter);
app.use("/api/v1/fds", fdRouter);

// Base route
app.get("/", (_req: Request, res: Response) => {
  res.send("Quanta Finance Bank Server Backend Running");
});

// Global Error Handler (Prevents Sensitive stack-trace exposure)
app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  console.error("Server Error:", err.message || err);
  res.status(err.status || 500).json({
    status: "error",
    message: err.status === 400 || err.status === 401 ? err.message : "An internal security or server error occurred."
  });
});

export default app;
