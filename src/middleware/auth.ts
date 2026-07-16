import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

export interface AuthRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: string;
  };
}

export const protect = (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): void => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    res.status(401).json({
      status: "error",
      message: "No token provided. Please login first.",
    });
    return;
  }

  const token = authHeader.split(" ")[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET as string) as {
      id: string;
      email: string;
      role: string;
    };

    req.user = decoded;
    next();
  } catch (err) {
    res.status(401).json({
      status: "error",
      message: "Invalid or expired token. Please login again.",
    });
  }
};

export const restrictTo = (...roles: string[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    if (!req.user || !roles.includes(req.user.role)) {
      res.status(403).json({
        status: "error",
        message: "You do not have permission to perform this action.",
      });
      return;
    }
    next();
  };
};

// Alias — both names work throughout the codebase
export const authenticate = protect;
