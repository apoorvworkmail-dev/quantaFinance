import { Request, Response } from "express";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// ── GET /beneficiaries ───────────────────────────────────────────────────────
export const getBeneficiaries = async (req: Request, res: Response): Promise<void> => {
  const userId = (req as any).user.id;
  try {
    const beneficiaries = await prisma.beneficiary.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
    });
    res.json({ status: "success", data: { beneficiaries } });
  } catch (err) {
    res.status(500).json({ status: "error", message: "Failed to fetch beneficiaries." });
  }
};

// ── POST /beneficiaries ──────────────────────────────────────────────────────
export const addBeneficiary = async (req: Request, res: Response): Promise<void> => {
  const userId = (req as any).user.id;
  const { nickname, accountNumber, bankName, ifscCode } = req.body;

  if (!nickname || !accountNumber) {
    res.status(400).json({ status: "error", message: "Nickname and account number are required." });
    return;
  }

  // Validate account number format (QB followed by digits)
  const accNumRegex = /^QB\d{8,12}$/i;
  if (bankName === "QuantaBank" || !bankName) {
    if (!accNumRegex.test(accountNumber)) {
      res.status(400).json({
        status: "error",
        message: "Invalid QuantaBank account number format. Must be QB followed by 8–12 digits."
      });
      return;
    }
  }

  // Check the target account actually exists (for QuantaBank accounts)
  if (!bankName || bankName === "QuantaBank") {
    const targetAccount = await prisma.account.findUnique({
      where: { accountNumber: accountNumber.toUpperCase() },
    });
    if (!targetAccount) {
      res.status(404).json({ status: "error", message: "Account not found in QuantaBank system." });
      return;
    }
    // Prevent adding own accounts
    if (targetAccount.userId === userId) {
      res.status(400).json({ status: "error", message: "You cannot add your own account as a beneficiary." });
      return;
    }
  }

  try {
    const beneficiary = await prisma.beneficiary.create({
      data: {
        userId,
        nickname: nickname.trim(),
        accountNumber: accountNumber.toUpperCase().trim(),
        bankName: bankName?.trim() || "QuantaBank",
        ifscCode: ifscCode?.trim() || null,
        status: "active",
      },
    });
    res.status(201).json({ status: "success", data: { beneficiary } });
  } catch (err: any) {
    if (err.code === "P2002") {
      res.status(409).json({ status: "error", message: "This account is already in your beneficiary list." });
      return;
    }
    res.status(500).json({ status: "error", message: "Failed to add beneficiary." });
  }
};

// ── PUT /beneficiaries/:id ───────────────────────────────────────────────────
export const updateBeneficiary = async (req: Request, res: Response): Promise<void> => {
  const userId = (req as any).user.id;
  const { id } = req.params;
  const { nickname, bankName, ifscCode } = req.body;

  try {
    const existing = await prisma.beneficiary.findFirst({ where: { id, userId } });
    if (!existing) {
      res.status(404).json({ status: "error", message: "Beneficiary not found." });
      return;
    }

    const updated = await prisma.beneficiary.update({
      where: { id },
      data: {
        nickname: nickname?.trim() ?? existing.nickname,
        bankName: bankName?.trim() ?? existing.bankName,
        ifscCode: ifscCode?.trim() ?? existing.ifscCode,
      },
    });
    res.json({ status: "success", data: { beneficiary: updated } });
  } catch {
    res.status(500).json({ status: "error", message: "Failed to update beneficiary." });
  }
};

// ── PATCH /beneficiaries/:id/status ─────────────────────────────────────────
export const toggleBeneficiaryStatus = async (req: Request, res: Response): Promise<void> => {
  const userId = (req as any).user.id;
  const { id } = req.params;
  const { status } = req.body;

  if (!["active", "inactive"].includes(status)) {
    res.status(400).json({ status: "error", message: "Status must be 'active' or 'inactive'." });
    return;
  }

  try {
    const existing = await prisma.beneficiary.findFirst({ where: { id, userId } });
    if (!existing) {
      res.status(404).json({ status: "error", message: "Beneficiary not found." });
      return;
    }

    const updated = await prisma.beneficiary.update({ where: { id }, data: { status } });
    res.json({ status: "success", data: { beneficiary: updated } });
  } catch {
    res.status(500).json({ status: "error", message: "Failed to update status." });
  }
};

// ── DELETE /beneficiaries/:id ────────────────────────────────────────────────
export const deleteBeneficiary = async (req: Request, res: Response): Promise<void> => {
  const userId = (req as any).user.id;
  const { id } = req.params;

  try {
    const existing = await prisma.beneficiary.findFirst({ where: { id, userId } });
    if (!existing) {
      res.status(404).json({ status: "error", message: "Beneficiary not found." });
      return;
    }

    await prisma.beneficiary.delete({ where: { id } });
    res.json({ status: "success", message: "Beneficiary removed successfully." });
  } catch {
    res.status(500).json({ status: "error", message: "Failed to delete beneficiary." });
  }
};
