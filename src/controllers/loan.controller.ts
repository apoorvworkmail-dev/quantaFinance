import { Response } from "express";
import { z } from "zod";
import { Decimal } from "@prisma/client/runtime/library";
import prisma from "../config/db";
import { AuthRequest } from "../middleware/auth";

const loanApplySchema = z.object({
  loanType: z.enum(["personal", "home", "auto", "education"]),
  principalAmount: z.number().positive(),
  termMonths: z.number().int().positive(),
  linkedAccountId: z.string().optional(),
});

const loanPaymentSchema = z.object({
  amount: z.number().positive(),
  sourceAccountId: z.string(),
});

// ── POST /api/v1/loans (Apply for Loan) ──────────────────────
export const applyForLoan = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!.id;
    const validatedData = loanApplySchema.parse(req.body);

    const interestRate = 5.0; // Fixed rate for simplicity

    const loan = await prisma.loan.create({
      data: {
        userId,
        loanType: validatedData.loanType,
        principalAmount: validatedData.principalAmount,
        interestRate,
        termMonths: validatedData.termMonths,
        remainingBalance: validatedData.principalAmount,
        linkedAccountId: validatedData.linkedAccountId,
        status: "pending",
      },
    });

    res.status(201).json({
      status: "success",
      message: "Loan application submitted and is pending approval.",
      data: { loan },
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ status: "error", message: "Validation error", errors: error.errors });
    } else {
      res.status(500).json({ status: "error", message: error.message || "Failed to apply for loan." });
    }
  }
};

// ── GET /api/v1/loans (Get My Loans) ─────────────────────────
export const getMyLoans = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!.id;
    const loans = await prisma.loan.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
    });

    res.status(200).json({
      status: "success",
      data: { loans },
    });
  } catch (error: any) {
    res.status(500).json({ status: "error", message: error.message || "Failed to fetch loans." });
  }
};

// ── GET /api/v1/loans/:id (Get Loan By ID) ───────────────────
export const getLoanById = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!.id;
    const { id } = req.params;

    const loan = await prisma.loan.findFirst({
      where: { id, userId },
    });

    if (!loan) {
      res.status(404).json({ status: "error", message: "Loan not found." });
      return;
    }

    res.status(200).json({
      status: "success",
      data: { loan },
    });
  } catch (error: any) {
    res.status(500).json({ status: "error", message: error.message || "Failed to fetch loan details." });
  }
};

// ── POST /api/v1/loans/:id/pay (Make Loan Payment) ───────────
export const payLoan = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!.id;
    const { id } = req.params;
    const validatedData = loanPaymentSchema.parse(req.body);

    const loan = await prisma.loan.findFirst({
      where: { id, userId },
    });

    if (!loan) {
      res.status(404).json({ status: "error", message: "Loan not found." });
      return;
    }

    if (loan.status !== "active") {
      res.status(400).json({ status: "error", message: `Cannot make payment on a loan with status: ${loan.status}` });
      return;
    }

    const sourceAccount = await prisma.account.findFirst({
      where: { id: validatedData.sourceAccountId, userId, status: "active" },
    });

    if (!sourceAccount) {
      res.status(404).json({ status: "error", message: "Source account not found or not active." });
      return;
    }

    const amountDecimal = new Decimal(validatedData.amount);

    if (sourceAccount.balance.lessThan(amountDecimal)) {
      res.status(400).json({ status: "error", message: "Insufficient funds in source account." });
      return;
    }

    // Process transaction
    await prisma.$transaction(async (tx) => {
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
          transactionType: "bill_pay",
          status: "completed",
          referenceDescription: `Loan Payment for ${loan.id}`,
        },
      });

      // Update loan balance
      const newBalance = new Decimal(loan.remainingBalance).minus(amountDecimal);
      const isPaidOff = newBalance.lessThanOrEqualTo(0);

      await tx.loan.update({
        where: { id: loan.id },
        data: {
          remainingBalance: isPaidOff ? 0 : newBalance,
          status: isPaidOff ? "paid_off" : "active",
        },
      });
    });

    res.status(200).json({
      status: "success",
      message: "Loan payment successful.",
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ status: "error", message: "Validation error", errors: error.errors });
    } else {
      res.status(500).json({ status: "error", message: error.message || "Failed to process loan payment." });
    }
  }
};
