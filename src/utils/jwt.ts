import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET as string;
const JWT_EXPIRES_IN = "15m";       // Access token: 15 minutes
const REFRESH_EXPIRES_IN = "7d";    // Refresh token: 7 days

export const generateAccessToken = (payload: {
  id: string;
  email: string;
  role: string;
}): string => {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
};

export const generateRefreshToken = (payload: { id: string }): string => {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: REFRESH_EXPIRES_IN });
};

export const verifyToken = (token: string) => {
  return jwt.verify(token, JWT_SECRET);
};

export const verifyRefreshToken = (token: string) => {
  return jwt.verify(token, JWT_SECRET);
};
