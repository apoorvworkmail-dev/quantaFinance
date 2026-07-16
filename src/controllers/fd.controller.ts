import { Response } from "express";
import { z } from "zod";
import { Decimal } from "@prisma/client/runtime/library";
import prisma from "../config/db";
import { AuthRequest } from "../middleware/auth";

const fdOpenSchema = z.object({
  principalAmount: z.number().positive(),
  termMonths: z.number().int().positive(),
  linkedAccountId: z.string(), // Must provide an account to draw from
});

// ── POST /api/v1/fds (Open Fixed Deposit) ────────────────────
export const openFD = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!.id;
    const validatedData = fdOpenSchema.parse(req.body);

    const interestRate = 7.0; // Fixed rate

    // Calculate maturity amount: Simple interest A = P(1 + rt)
    // t is in years.
    const principal = validatedData.principalAmount;
    const timeInYears = validatedData.termMonths / 12;
    const maturityAmount = principal * (1 + (interestRate / 100) * timeInYears);
    const maturityDate = new Date();
    maturityDate.setMonth(maturityDate.getMonth() + validatedData.termMonths);

    // Verify source account and balance
    const sourceAccount = await prisma.account.findFirst({
      where: { id: validatedData.linkedAccountId, userId, status: "active" },
    });

    if (!sourceAccount) {
      res.status(404).json({ status: "error", message: "Source account not found or not active." });
      return;
    }

    const amountDecimal = new Decimal(principal);
    if (sourceAccount.balance.lessThan(amountDecimal)) {
      res.status(400).json({ status: "error", message: "Insufficient funds in source account." });
      return;
    }

    // Process transaction
    const fd = await prisma.$transaction(async (tx) => {
      // Deduct from account
      await tx.account.update({
        where: { id: sourceAccount.id },
        data: { balance: { decrement: amountDecimal } },
      });

      // Log transaction
      await tx.transaction.create({
        data: {
          sourceAccountId: sourceAccount.id,
          amount: amountDecimal,
          currency: sourceAccount.currency,
          transactionType: "withdrawal",
          status: "completed",
          referenceDescription: "Opened Fixed Deposit",
        },
      });

      // Create FD
      return await tx.fixedDeposit.create({
        data: {
          userId,
          linkedAccountId: sourceAccount.id,
          principalAmount: amountDecimal,
          interestRate,
          maturityDate,
          maturityAmount: new Decimal(maturityAmount),
          status: "active",
        },
      });
    });

    res.status(201).json({
      status: "success",
      message: "Fixed Deposit opened successfully.",
      data: { fd },
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ status: "error", message: "Validation error", errors: error.errors });
    } else {
      res.status(500).json({ status: "error", message: error.message || "Failed to open FD." });
    }
  }
};

// ── GET /api/v1/fds (Get My FDs) ──────────────────────────────
export const getMyFDs = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!.id;
    const fds = await prisma.fixedDeposit.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
    });

    res.status(200).json({
      status: "success",
      data: { fds },
    });
  } catch (error: any) {
    res.status(500).json({ status: "error", message: error.message || "Failed to fetch FDs." });
  }
};

// ── GET /api/v1/fds/:id (Get FD By ID) ───────────────────────
export const getFDById = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!.id;
    const { id } = req.params;

    const fd = await prisma.fixedDeposit.findFirst({
      where: { id, userId },
    });

    if (!fd) {
      res.status(404).json({ status: "error", message: "FD not found." });
      return;
    }

    res.status(200).json({
      status: "success",
      data: { fd },
    });
  } catch (error: any) {
    res.status(500).json({ status: "error", message: error.message || "Failed to fetch FD details." });
  }
};

// ── POST /api/v1/fds/:id/close (Close FD) ────────────────────
export const closeFD = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!.id;
    const { id } = req.params;

    const fd = await prisma.fixedDeposit.findFirst({
      where: { id, userId },
    });

    if (!fd) {
      res.status(404).json({ status: "error", message: "FD not found." });
      return;
    }

    if (fd.status !== "active") {
      res.status(400).json({ status: "error", message: `Cannot close an FD with status: ${fd.status}` });
      return;
    }

    const linkedAccount = await prisma.account.findFirst({
      where: { id: fd.linkedAccountId || "", userId },
    });

    if (!linkedAccount) {
      res.status(404).json({ status: "error", message: "Linked account not found to credit funds." });
      return;
    }

    const isMature = new Date() >= fd.maturityDate;
    // If mature, give full maturity amount. If premature, just return principal (penalty is losing interest).
    const payoutAmount = isMature ? fd.maturityAmount : fd.principalAmount;

    // Process transaction
    await prisma.$transaction(async (tx) => {
      // Credit to account
      await tx.account.update({
        where: { id: linkedAccount.id },
        data: { balance: { increment: payoutAmount } },
      });

      // Log transaction
      await tx.transaction.create({
        data: {
          destinationAccountId: linkedAccount.id,
          amount: payoutAmount,
          currency: linkedAccount.currency,
          transactionType: "deposit",
          status: "completed",
          referenceDescription: `Closed Fixed Deposit (Payout)`,
        },
      });

      // Update FD status
      await tx.fixedDeposit.update({
        where: { id: fd.id },
        data: { status: isMature ? "matured" : "prematurely_closed" },
      });
    });

    res.status(200).json({
      status: "success",
      message: "Fixed Deposit closed successfully. Funds credited to your account.",
      data: { payoutAmount },
    });
  } catch (error: any) {
    res.status(500).json({ status: "error", message: error.message || "Failed to close FD." });
  }
};
