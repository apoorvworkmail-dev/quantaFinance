import { Response } from "express";
import { z } from "zod";
import { Decimal } from "@prisma/client/runtime/library";
import prisma from "../config/db";
import { AuthRequest } from "../middleware/auth";
import { sendOTPEmail } from "../utils/email";

// ── Validation Schemas ───────────────────────────────────────────────────────

const transferSchema = z.object({
  fromAccountId: z.string().uuid("Invalid source account ID"),
  toAccountNumber: z.string().min(1, "Destination account number is required"),
  amount: z.number().positive("Amount must be greater than 0").max(1000000, "Amount exceeds single transfer limit"),
  currency: z.string().length(3).default("USD"),
  description: z.string().max(200).optional(),
  idempotencyKey: z.string().min(1, "Idempotency key is required"),
  otpCode: z.string().length(6, "6-digit OTP code is required"),
});

const depositSchema = z.object({
  toAccountId: z.string().uuid("Invalid account ID"),
  amount: z.number().positive("Amount must be greater than 0").max(100000, "Single deposit limit exceeded"),
  description: z.string().max(200).optional(),
});

const txFilterSchema = z.object({
  type: z.enum(["transfer", "deposit", "withdrawal"]).optional(),
  status: z.enum(["pending", "completed", "failed", "reversed"]).optional(),
  from: z.string().optional(),
  to: z.string().optional(),
  page: z.string().transform(Number).default("1"),
  limit: z.string().transform(Number).default("20"),
  search: z.string().optional(),
  sortBy: z.enum(["createdAt", "amount"]).default("createdAt"),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
});

// ── Helpers ───────────────────────────────────────────────────────────────────

const generateOTPCode = (): string =>
  Math.floor(100000 + Math.random() * 900000).toString();

// ── Send Transfer OTP ─────────────────────────────────────────────────────────

export const sendTransferOTP = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!.id;
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      res.status(404).json({ status: "error", message: "User not found." });
      return;
    }

    // Invalidate existing transfer OTPs
    await prisma.oTP.updateMany({
      where: { userId, type: "transfer_otp", used: false },
      data: { used: true },
    });

    const code = generateOTPCode();
    await prisma.oTP.create({
      data: {
        userId,
        code,
        type: "transfer_otp",
        expiresAt: new Date(Date.now() + 10 * 60 * 1000), // 10 mins
      },
    });

    try {
      await sendOTPEmail(user.email, user.firstName, code, "transfer_otp");
    } catch {
      // fallback logging in dev
      console.log(`\n🔑 DEV TRANSFER OTP: ${code}\n`);
    }

    res.json({ status: "success", message: "Verification OTP code sent to your email." });
  } catch (error) {
    res.status(500).json({ status: "error", message: "Failed to send verification code." });
  }
};

// ── Transfer ──────────────────────────────────────────────────────────────────

export const transfer = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const parsed = transferSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        status: "error",
        message: "Validation failed",
        errors: parsed.error.flatten().fieldErrors,
      });
      return;
    }

    const { fromAccountId, toAccountNumber, amount, currency, description, idempotencyKey, otpCode } = parsed.data;

    // 1. Verify OTP code
    const otpRecord = await prisma.oTP.findFirst({
      where: { userId: req.user!.id, code: otpCode, type: "transfer_otp", used: false },
    });

    if (!otpRecord || otpRecord.expiresAt < new Date()) {
      res.status(400).json({ status: "error", message: "Invalid or expired transfer OTP code." });
      return;
    }

    // Check idempotency
    const existing = await prisma.transaction.findUnique({
      where: { idempotencyKey },
    });
    if (existing) {
      res.status(200).json({
        status: "success",
        message: "Transaction already processed (idempotent response).",
        data: { transaction: existing },
      });
      return;
    }

    // Source Account checks
    const sourceAccount = await prisma.account.findFirst({
      where: { id: fromAccountId, userId: req.user!.id },
    });
    if (!sourceAccount) {
      res.status(404).json({ status: "error", message: "Source account not found." });
      return;
    }
    if (sourceAccount.status === "frozen") {
      res.status(400).json({ status: "error", message: "Source account is frozen." });
      return;
    }
    if (sourceAccount.status === "closed") {
      res.status(400).json({ status: "error", message: "Source account is closed." });
      return;
    }

    // Destination Account checks
    const destinationAccount = await prisma.account.findFirst({
      where: { accountNumber: toAccountNumber },
    });
    if (!destinationAccount) {
      res.status(404).json({ status: "error", message: "Recipient account not found." });
      return;
    }
    if (destinationAccount.status !== "active") {
      res.status(400).json({ status: "error", message: "Recipient account is not active." });
      return;
    }
    if (sourceAccount.id === destinationAccount.id) {
      res.status(400).json({ status: "error", message: "Cannot transfer to the same account." });
      return;
    }

    // Daily Limit checks
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const todaysTransfers = await prisma.transaction.aggregate({
      where: {
        sourceAccountId: sourceAccount.id,
        status: "completed",
        createdAt: { gte: today },
      },
      _sum: { amount: true },
    });

    const currentSpentToday = Number(todaysTransfers._sum.amount ?? 0);
    const dailyLimit = Number(sourceAccount.dailyTransferLimit);
    if (currentSpentToday + amount > dailyLimit) {
      res.status(400).json({
        status: "error",
        message: `Daily transfer limit exceeded. Remaining limit today: ${currency} ${(dailyLimit - currentSpentToday).toLocaleString()}`,
      });
      return;
    }

    // Balance check
    const transferAmount = new Decimal(amount);
    if (new Decimal(sourceAccount.balance).lessThan(transferAmount)) {
      res.status(400).json({ status: "error", message: "Insufficient funds." });
      return;
    }

    // Process Transfer Atomically
    const transaction = await prisma.$transaction(async (tx) => {
      // Mark OTP as used
      await tx.oTP.update({ where: { id: otpRecord.id }, data: { used: true } });

      // Debit source
      await tx.account.update({
        where: { id: sourceAccount.id },
        data: { balance: { decrement: amount } },
      });

      // Credit destination
      await tx.account.update({
        where: { id: destinationAccount.id },
        data: { balance: { increment: amount } },
      });

      // Create transaction
      return tx.transaction.create({
        data: {
          sourceAccountId: sourceAccount.id,
          destinationAccountId: destinationAccount.id,
          amount: transferAmount,
          currency,
          transactionType: "transfer",
          status: "completed",
          referenceDescription: description ?? "Fund Transfer",
          idempotencyKey,
        },
      });
    });

    // Audit Log
    await prisma.auditLog.create({
      data: {
        userId: req.user!.id,
        action: `TRANSFER_COMPLETED`,
        metadata: JSON.stringify({ txId: transaction.id, amount, from: sourceAccount.accountNumber, to: destinationAccount.accountNumber }),
        ipAddress: req.ip ?? null,
        userAgent: req.headers["user-agent"] ?? null,
      },
    });

    res.status(201).json({
      status: "success",
      message: "Transfer completed successfully.",
      data: {
        transaction: {
          id: transaction.id,
          amount: transaction.amount,
          currency: transaction.currency,
          status: transaction.status,
          from: sourceAccount.accountNumber,
          to: destinationAccount.accountNumber,
          createdAt: transaction.createdAt,
        },
      },
    });
  } catch (error: any) {
    console.error("Transfer error:", error);
    res.status(500).json({ status: "error", message: "Transfer failed." });
  }
};

// ── Deposit ───────────────────────────────────────────────────────────────────

export const deposit = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const parsed = depositSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ status: "error", message: "Validation failed", errors: parsed.error.flatten().fieldErrors });
      return;
    }

    const { toAccountId, amount, description } = parsed.data;

    const account = await prisma.account.findFirst({
      where: { id: toAccountId, userId: req.user!.id },
    });

    if (!account) {
      res.status(404).json({ status: "error", message: "Account not found." });
      return;
    }
    if (account.status !== "active") {
      res.status(400).json({ status: "error", message: "Cannot deposit to a inactive account." });
      return;
    }

    const transaction = await prisma.$transaction(async (tx) => {
      await tx.account.update({
        where: { id: account.id },
        data: { balance: { increment: amount } },
      });

      return tx.transaction.create({
        data: {
          destinationAccountId: account.id,
          amount: new Decimal(amount),
          currency: account.currency,
          transactionType: "deposit",
          status: "completed",
          referenceDescription: description ?? "Cash deposit",
        },
      });
    });

    res.status(201).json({
      status: "success",
      message: "Deposit successful.",
      data: { transaction },
    });
  } catch (error) {
    res.status(500).json({ status: "error", message: "Deposit failed." });
  }
};

// ── Get Transactions ──────────────────────────────────────────────────────────

export const getTransactions = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const parsed = txFilterSchema.safeParse(req.query);
    if (!parsed.success) {
      res.status(400).json({ status: "error", message: "Invalid parameters." });
      return;
    }

    const { type, status, from, to, page, limit, search, sortBy, sortOrder } = parsed.data;
    const skip = (page - 1) * limit;

    const userAccounts = await prisma.account.findMany({
      where: { userId: req.user!.id },
      select: { id: true },
    });
    const accountIds = userAccounts.map((a) => a.id);

    // Build query conditions
    const conditions: any[] = [
      {
        OR: [
          { sourceAccountId: { in: accountIds } },
          { destinationAccountId: { in: accountIds } },
        ],
      },
    ];

    if (type) conditions.push({ transactionType: type });
    if (status) conditions.push({ status });
    if (from) conditions.push({ createdAt: { gte: new Date(from) } });
    if (to) conditions.push({ createdAt: { lte: new Date(to) } });

    if (search) {
      const searchAmt = Number(search);
      conditions.push({
        OR: [
          { referenceDescription: { contains: search } },
          ...(!isNaN(searchAmt) ? [{ amount: searchAmt }] : []),
          { sourceAccount: { accountNumber: { contains: search } } },
          { destinationAccount: { accountNumber: { contains: search } } },
        ],
      });
    }

    const where = { AND: conditions };

    const [transactions, total] = await prisma.$transaction([
      prisma.transaction.findMany({
        where,
        orderBy: { [sortBy]: sortOrder },
        skip,
        take: limit,
        include: {
          sourceAccount: { select: { accountNumber: true } },
          destinationAccount: { select: { accountNumber: true } },
        },
      }),
      prisma.transaction.count({ where }),
    ]);

    res.json({
      status: "success",
      data: {
        transactions,
        pagination: { total, page, limit, totalPages: Math.ceil(total / limit) },
      },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ status: "error", message: "Failed to fetch transactions." });
  }
};

// ── Get Single Transaction ────────────────────────────────────────────────────

export const getTransactionById = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userAccounts = await prisma.account.findMany({
      where: { userId: req.user!.id },
      select: { id: true },
    });
    const accountIds = userAccounts.map((a) => a.id);

    const transaction = await prisma.transaction.findFirst({
      where: {
        id: req.params.id,
        OR: [
          { sourceAccountId: { in: accountIds } },
          { destinationAccountId: { in: accountIds } },
        ],
      },
      include: {
        sourceAccount: { select: { accountNumber: true } },
        destinationAccount: { select: { accountNumber: true } },
      },
    });

    if (!transaction) {
      res.status(404).json({ status: "error", message: "Transaction not found." });
      return;
    }

    res.json({ status: "success", data: { transaction } });
  } catch (error) {
    res.status(500).json({ status: "error", message: "Failed to fetch details." });
  }
};
