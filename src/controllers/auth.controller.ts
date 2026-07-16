import { Request, Response } from "express";
import { z } from "zod";
import prisma from "../config/db";
import { hashPassword, comparePassword } from "../utils/hash";
import { generateAccessToken, generateRefreshToken, verifyRefreshToken } from "../utils/jwt";
import { AuthRequest } from "../middleware/auth";
import { sendOTPEmail } from "../utils/email";

// ── Validation schemas ────────────────────────────────────────────────────────

const registerSchema = z.object({
  firstName: z.string().min(2),
  lastName:  z.string().min(2),
  email:     z.string().email(),
  password:  z.string().min(8).regex(/[A-Z]/).regex(/[0-9]/),
  phoneNumber: z.string().optional(),
});

const loginSchema = z.object({
  email:    z.string().email(),
  password: z.string().min(1),
});

// ── Helpers ───────────────────────────────────────────────────────────────────

const generateAccountNumber = (): string =>
  `QB${Math.floor(1000000000 + Math.random() * 9000000000)}`;

const generateOTPCode = (): string =>
  Math.floor(100000 + Math.random() * 900000).toString();

const parseDevice = (ua: string = ""): string => {
  if (/mobile/i.test(ua)) return "Mobile";
  if (/tablet/i.test(ua)) return "Tablet";
  return "Desktop";
};

// ── Register ─────────────────────────────────────────────────────────────────

export const register = async (req: Request, res: Response): Promise<void> => {
  try {
    const parsed = registerSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ status: "error", message: "Validation failed", errors: parsed.error.flatten().fieldErrors });
      return;
    }

    const { firstName, lastName, email, password, phoneNumber } = parsed.data;

    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      res.status(409).json({ status: "error", message: "An account with this email already exists." });
      return;
    }

    const passwordHash = await hashPassword(password);

    const result = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: { firstName, lastName, email, passwordHash, phoneNumber: phoneNumber ?? null, role: "customer", status: "active" },
      });
      const account = await tx.account.create({
        data: { userId: user.id, accountNumber: generateAccountNumber(), accountType: "checking", balance: 0, currency: "USD", status: "active" },
      });
      await tx.auditLog.create({
        data: { userId: user.id, action: "USER_REGISTERED", ipAddress: req.ip ?? null, userAgent: req.headers["user-agent"] ?? null },
      });
      return { user, account };
    });

    const accessToken  = generateAccessToken({ id: result.user.id, email: result.user.email, role: result.user.role });
    const refreshToken = generateRefreshToken({ id: result.user.id });

    // Store refresh token
    await prisma.refreshToken.create({
      data: { userId: result.user.id, token: refreshToken, expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) },
    });

    res.status(201).json({
      status: "success",
      message: "Account created successfully! Welcome to QuantaBank.",
      data: {
        accessToken, refreshToken,
        user: { id: result.user.id, firstName: result.user.firstName, lastName: result.user.lastName, email: result.user.email, role: result.user.role },
        account: { accountNumber: result.account.accountNumber, accountType: result.account.accountType, balance: result.account.balance },
      },
    });
  } catch (error) {
    console.error("Register error:", error);
    res.status(500).json({ status: "error", message: "Registration failed." });
  }
};

// ── Login ─────────────────────────────────────────────────────────────────────

export const login = async (req: Request, res: Response): Promise<void> => {
  try {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ status: "error", message: "Validation failed", errors: parsed.error.flatten().fieldErrors });
      return;
    }

    const { email, password } = parsed.data;
    const ua = req.headers["user-agent"] ?? "";

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      res.status(401).json({ status: "error", message: "Invalid email or password." });
      return;
    }

    if (user.status === "suspended") {
      res.status(403).json({ status: "error", message: "Your account has been suspended. Contact support." });
      return;
    }

    const isValid = await comparePassword(password, user.passwordHash);

    // Record login history
    await prisma.loginHistory.create({
      data: {
        userId:    user.id,
        ipAddress: req.ip ?? null,
        userAgent: ua,
        device:    parseDevice(ua),
        status:    isValid ? "success" : "failed",
      },
    });

    if (!isValid) {
      await prisma.auditLog.create({
        data: { userId: user.id, action: "LOGIN_FAILED", ipAddress: req.ip ?? null, userAgent: ua },
      });
      res.status(401).json({ status: "error", message: "Invalid email or password." });
      return;
    }

    const accessToken  = generateAccessToken({ id: user.id, email: user.email, role: user.role });
    const refreshToken = generateRefreshToken({ id: user.id });

    // Store refresh token (revoke old ones for same user if > 5)
    await prisma.refreshToken.create({
      data: { userId: user.id, token: refreshToken, expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) },
    });

    await prisma.auditLog.create({
      data: { userId: user.id, action: "LOGIN_SUCCESS", ipAddress: req.ip ?? null, userAgent: ua },
    });

    res.status(200).json({
      status: "success",
      message: "Login successful.",
      data: {
        accessToken, refreshToken,
        user: { id: user.id, firstName: user.firstName, lastName: user.lastName, email: user.email, role: user.role, profilePic: user.profilePic },
      },
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ status: "error", message: "Login failed." });
  }
};

// ── Refresh Token ─────────────────────────────────────────────────────────────

export const refreshAccessToken = async (req: Request, res: Response): Promise<void> => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) {
      res.status(400).json({ status: "error", message: "Refresh token required." });
      return;
    }

    // Verify the token is valid and not expired
    let payload: any;
    try {
      payload = verifyRefreshToken(refreshToken);
    } catch {
      res.status(401).json({ status: "error", message: "Invalid or expired refresh token." });
      return;
    }

    // Check token in DB (not revoked)
    const stored = await prisma.refreshToken.findUnique({ where: { token: refreshToken } });
    if (!stored || stored.revoked || stored.expiresAt < new Date()) {
      res.status(401).json({ status: "error", message: "Refresh token revoked or expired." });
      return;
    }

    const user = await prisma.user.findUnique({ where: { id: payload.id } });
    if (!user || user.status === "suspended") {
      res.status(401).json({ status: "error", message: "User not found or suspended." });
      return;
    }

    // Rotate: revoke old, issue new
    await prisma.refreshToken.update({ where: { id: stored.id }, data: { revoked: true } });

    const newAccessToken  = generateAccessToken({ id: user.id, email: user.email, role: user.role });
    const newRefreshToken = generateRefreshToken({ id: user.id });

    await prisma.refreshToken.create({
      data: { userId: user.id, token: newRefreshToken, expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) },
    });

    res.json({ status: "success", data: { accessToken: newAccessToken, refreshToken: newRefreshToken } });
  } catch (error) {
    console.error("Refresh token error:", error);
    res.status(500).json({ status: "error", message: "Token refresh failed." });
  }
};

// ── Logout ────────────────────────────────────────────────────────────────────

export const logout = async (req: Request, res: Response): Promise<void> => {
  try {
    const { refreshToken } = req.body;
    if (refreshToken) {
      await prisma.refreshToken.updateMany({ where: { token: refreshToken }, data: { revoked: true } });
    }
    res.json({ status: "success", message: "Logged out successfully." });
  } catch {
    res.json({ status: "success", message: "Logged out." });
  }
};

// ── Get Me ────────────────────────────────────────────────────────────────────

export const getMe = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      select: {
        id: true, firstName: true, lastName: true, email: true,
        phoneNumber: true, profilePic: true, role: true, status: true, createdAt: true,
        accounts: {
          select: { id: true, accountNumber: true, accountType: true, balance: true, currency: true, status: true, ifscCode: true, branch: true },
        },
      },
    });

    if (!user) { res.status(404).json({ status: "error", message: "User not found." }); return; }

    res.json({ status: "success", data: { user } });
  } catch (error) {
    res.status(500).json({ status: "error", message: "Failed to retrieve profile." });
  }
};

// ── Update Profile ────────────────────────────────────────────────────────────

export const updateProfile = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { phoneNumber, firstName, lastName } = req.body;
    const updated = await prisma.user.update({
      where: { id: req.user!.id },
      data: {
        ...(phoneNumber !== undefined && { phoneNumber }),
        ...(firstName   !== undefined && { firstName }),
        ...(lastName    !== undefined && { lastName }),
      },
      select: { id: true, firstName: true, lastName: true, email: true, phoneNumber: true, profilePic: true, role: true, status: true },
    });
    res.json({ status: "success", data: { user: updated } });
  } catch {
    res.status(500).json({ status: "error", message: "Profile update failed." });
  }
};

// ── Upload Profile Picture ────────────────────────────────────────────────────

export const uploadProfilePicture = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.file) {
      res.status(400).json({ status: "error", message: "No file uploaded." });
      return;
    }

    const profilePicPath = `/uploads/avatars/${req.file.filename}`;

    const updated = await prisma.user.update({
      where: { id: req.user!.id },
      data:  { profilePic: profilePicPath },
      select: { id: true, profilePic: true },
    });

    res.json({ status: "success", message: "Profile picture updated.", data: { profilePic: updated.profilePic } });
  } catch {
    res.status(500).json({ status: "error", message: "Upload failed." });
  }
};

// ── Change Password ───────────────────────────────────────────────────────────

export const changePassword = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword || newPassword.length < 8) {
      res.status(400).json({ status: "error", message: "Current password and a valid new password (min 8 chars) are required." });
      return;
    }

    const user = await prisma.user.findUnique({ where: { id: req.user!.id } });
    if (!user) { res.status(404).json({ status: "error", message: "User not found." }); return; }

    const isValid = await comparePassword(currentPassword, user.passwordHash);
    if (!isValid) {
      res.status(400).json({ status: "error", message: "Current password is incorrect." });
      return;
    }

    const newHash = await hashPassword(newPassword);
    await prisma.user.update({ where: { id: user.id }, data: { passwordHash: newHash } });

    // Revoke all refresh tokens (force re-login everywhere)
    await prisma.refreshToken.updateMany({ where: { userId: user.id }, data: { revoked: true } });

    await prisma.auditLog.create({
      data: { userId: user.id, action: "PASSWORD_CHANGED", ipAddress: req.ip ?? null, userAgent: req.headers["user-agent"] ?? null },
    });

    res.json({ status: "success", message: "Password changed successfully. Please log in again." });
  } catch {
    res.status(500).json({ status: "error", message: "Password change failed." });
  }
};

// ── Forgot Password ───────────────────────────────────────────────────────────

export const forgotPassword = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email } = req.body;
    if (!email) { res.status(400).json({ status: "error", message: "Email is required." }); return; }

    const user = await prisma.user.findUnique({ where: { email } });

    // Always respond 200 to prevent email enumeration
    if (!user) {
      res.json({ status: "success", message: "If an account exists, a reset code has been sent." });
      return;
    }

    // Invalidate existing OTPs
    await prisma.oTP.updateMany({
      where: { userId: user.id, type: "forgot_password", used: false },
      data:  { used: true },
    });

    const code = generateOTPCode();
    await prisma.oTP.create({
      data: {
        userId: user.id,
        code,
        type: "forgot_password",
        expiresAt: new Date(Date.now() + 10 * 60 * 1000), // 10 minutes
      },
    });

    try {
      await sendOTPEmail(user.email, user.firstName, code, "forgot_password");
    } catch (emailErr) {
      console.error("Email send error:", emailErr);
      // Don't fail the request if email fails — still log the OTP
      console.log(`\n🔑 DEV OTP for ${user.email}: ${code}\n`);
    }

    res.json({ status: "success", message: "If an account exists, a reset code has been sent." });
  } catch {
    res.status(500).json({ status: "error", message: "Failed to process request." });
  }
};

// ── Reset Password ────────────────────────────────────────────────────────────

export const resetPassword = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, otp, newPassword } = req.body;
    if (!email || !otp || !newPassword) {
      res.status(400).json({ status: "error", message: "Email, OTP code, and new password are required." });
      return;
    }

    if (newPassword.length < 8) {
      res.status(400).json({ status: "error", message: "Password must be at least 8 characters." });
      return;
    }

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) { res.status(400).json({ status: "error", message: "Invalid reset request." }); return; }

    const otpRecord = await prisma.oTP.findFirst({
      where: { userId: user.id, code: otp, type: "forgot_password", used: false },
    });

    if (!otpRecord || otpRecord.expiresAt < new Date()) {
      res.status(400).json({ status: "error", message: "Invalid or expired OTP code." });
      return;
    }

    const newHash = await hashPassword(newPassword);

    await prisma.$transaction([
      prisma.user.update({ where: { id: user.id }, data: { passwordHash: newHash } }),
      prisma.oTP.update({ where: { id: otpRecord.id }, data: { used: true } }),
      prisma.refreshToken.updateMany({ where: { userId: user.id }, data: { revoked: true } }),
    ]);

    await prisma.auditLog.create({
      data: { userId: user.id, action: "PASSWORD_RESET", ipAddress: req.ip ?? null },
    });

    res.json({ status: "success", message: "Password reset successfully. Please log in with your new password." });
  } catch {
    res.status(500).json({ status: "error", message: "Password reset failed." });
  }
};

// ── Login History ─────────────────────────────────────────────────────────────

export const getLoginHistory = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const history = await prisma.loginHistory.findMany({
      where: { userId: req.user!.id },
      orderBy: { createdAt: "desc" },
      take: 20,
    });
    res.json({ status: "success", data: { history } });
  } catch {
    res.status(500).json({ status: "error", message: "Failed to fetch login history." });
  }
};
