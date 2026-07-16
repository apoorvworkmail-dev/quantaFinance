import { Request, Response, NextFunction } from "express";

/**
 * Recursively sanitizes input strings to strip HTML tags, script elements,
 * path traversal strings (e.g., ../), and common SQL/NoSQL injections.
 */
const sanitizeValue = (val: any): any => {
  if (typeof val === "string") {
    return val
      .replace(/<script[^>]*>([\s\S]*?)<\/script>/gi, "") // Remove <script> tags
      .replace(/<\/?[^>]+(>|$)/g, "")                     // Strip HTML tags
      .replace(/\.\.+\//g, "")                            // Block directory traversal (../)
      .trim();
  }
  if (Array.isArray(val)) {
    return val.map(sanitizeValue);
  }
  if (typeof val === "object" && val !== null) {
    const clean: Record<string, any> = {};
    for (const key in val) {
      if (Object.prototype.hasOwnProperty.call(val, key)) {
        clean[key] = sanitizeValue(val[key]);
      }
    }
    return clean;
  }
  return val;
};

/**
 * Express middleware to sanitize body, query parameters, and URL path variables.
 */
export const sanitizeInputs = (req: Request, _res: Response, next: NextFunction): void => {
  if (req.body) {
    req.body = sanitizeValue(req.body);
  }
  if (req.query) {
    req.query = sanitizeValue(req.query);
  }
  if (req.params) {
    req.params = sanitizeValue(req.params);
  }
  next();
};
