import { Router } from "express";
import multer from "multer";
import path from "path";
import {
  register, login, logout, refreshAccessToken,
  getMe, updateProfile, uploadProfilePicture, changePassword,
  forgotPassword, resetPassword, getLoginHistory,
} from "../controllers/auth.controller";
import { authenticate } from "../middleware/auth";

const router = Router();

// ── Multer config for profile pictures ──────────────────────────────────────
const storage = multer.diskStorage({
  destination: "uploads/avatars/",
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `avatar-${Date.now()}${ext}`);
  },
});
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
  fileFilter: (_req, file, cb) => {
    if (/\.(jpg|jpeg|png|webp)$/i.test(file.originalname)) cb(null, true);
    else cb(new Error("Only JPG, PNG, WEBP images allowed."));
  },
});

// ── Public routes ─────────────────────────────────────────────────────────────
router.post("/register",        register);
router.post("/login",           login);
router.post("/logout",          logout);
router.post("/refresh",         refreshAccessToken);
router.post("/forgot-password", forgotPassword);
router.post("/reset-password",  resetPassword);

// ── Protected routes ──────────────────────────────────────────────────────────
router.get("/me",              authenticate, getMe);
router.put("/me",              authenticate, updateProfile);
router.post("/change-password",authenticate, changePassword);
router.get("/login-history",   authenticate, getLoginHistory);
router.post(
  "/upload-avatar",
  authenticate,
  upload.single("avatar"),
  uploadProfilePicture
);

export default router;
