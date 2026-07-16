import { Response } from "express";
import { z } from "zod";
import prisma from "../config/db";
import { AuthRequest } from "../middleware/auth";

// ── Validation Schemas ───────────────────────────────────────────────────────

const openAccountSchema = z.object({
  accountType: z.enum(["checking", "savings", "loan"], {
    errorMap: () => ({ message: "Account type must be: checking, savings, or loan" }),
  }),
  currency: z.string().length(3, "Currency must be a 3-letter code (e.g. USD)").default("USD"),
});

const updateStatusSchema = z.object({
  status: z.enum(["active", "frozen", "closed"], {
    errorMap: () => ({ message: "Status must be: active, frozen, or closed" }),
  }),
});

// ── Helpers ──────────────────────────────────────────────────────────────────

const generateAccountNumber = (): string => {
  const prefix = "QB";
  const digits = Math.floor(1000000000 + Math.random() * 9000000000).toString();
  return `${prefix}${digits}`;
};

// ── Controllers ──────────────────────────────────────────────────────────────

/**
 * GET /api/v1/accounts
 * Returns all accounts belonging to the logged-in user
 */
export const getMyAccounts = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const accounts = await prisma.account.findMany({
      where: { userId: req.user!.id },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        accountNumber: true,
        accountType: true,
        balance: true,
        currency: true,
        status: true,
        createdAt: true,
      },
    });

    res.status(200).json({
      status: "success",
      count: accounts.length,
      data: { accounts },
    });
  } catch (error: any) {
    console.error("getMyAccounts error:", error);
    res.status(500).json({ status: "error", message: "Failed to fetch accounts." });
  }
};

/**
 * GET /api/v1/accounts/:id
 * Returns a single account with recent transactions
 */
export const getAccountById = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const account = await prisma.account.findFirst({
      where: {
        id: req.params.id,
        userId: req.user!.id, // Ensure the account belongs to the logged-in user
      },
      include: {
        sentTransactions: {
          orderBy: { createdAt: "desc" },
          take: 10,
          select: {
            id: true,
            amount: true,
            currency: true,
            transactionType: true,
            status: true,
            referenceDescription: true,
            createdAt: true,
            destinationAccount: {
              select: { accountNumber: true },
            },
          },
        },
        receivedTransactions: {
          orderBy: { createdAt: "desc" },
          take: 10,
          select: {
            id: true,
            amount: true,
            currency: true,
            transactionType: true,
            status: true,
            referenceDescription: true,
            createdAt: true,
            sourceAccount: {
              select: { accountNumber: true },
            },
          },
        },
      },
    });

    if (!account) {
      res.status(404).json({
        status: "error",
        message: "Account not found or does not belong to you.",
      });
      return;
    }

    res.status(200).json({
      status: "success",
      data: { account },
    });
  } catch (error: any) {
    console.error("getAccountById error:", error);
    res.status(500).json({ status: "error", message: "Failed to fetch account." });
  }
};

/**
 * POST /api/v1/accounts
 * Opens a new bank account for the logged-in user
 */
export const openAccount = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const parsed = openAccountSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        status: "error",
        message: "Validation failed",
        errors: parsed.error.flatten().fieldErrors,
      });
      return;
    }

    const { accountType, currency } = parsed.data;

    // Limit: max 5 accounts per user
    const existingCount = await prisma.account.count({
      where: { userId: req.user!.id },
    });

    if (existingCount >= 5) {
      res.status(400).json({
        status: "error",
        message: "You have reached the maximum limit of 5 accounts.",
      });
      return;
    }

    const account = await prisma.$transaction(async (tx) => {
      const newAccount = await tx.account.create({
        data: {
          userId: req.user!.id,
          accountNumber: generateAccountNumber(),
          accountType,
          balance: 0,
          currency,
          status: "active",
        },
      });

      await tx.auditLog.create({
        data: {
          userId: req.user!.id,
          action: `ACCOUNT_OPENED:${accountType.toUpperCase()}`,
          ipAddress: req.ip ?? null,
          userAgent: req.headers["user-agent"] ?? null,
        },
      });

      return newAccount;
    });

    res.status(201).json({
      status: "success",
      message: `Your new ${accountType} account has been opened successfully!`,
      data: {
        account: {
          id: account.id,
          accountNumber: account.accountNumber,
          accountType: account.accountType,
          balance: account.balance,
          currency: account.currency,
          status: account.status,
          createdAt: account.createdAt,
        },
      },
    });
  } catch (error: any) {
    console.error("openAccount error:", error);
    res.status(500).json({ status: "error", message: "Failed to open account." });
  }
};

/**
 * PATCH /api/v1/accounts/:id/status
 * Freeze, unfreeze, or close an account
 */
export const updateAccountStatus = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const parsed = updateStatusSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        status: "error",
        message: "Validation failed",
        errors: parsed.error.flatten().fieldErrors,
      });
      return;
    }

    const { status } = parsed.data;

    // Check account belongs to user
    const account = await prisma.account.findFirst({
      where: { id: req.params.id, userId: req.user!.id },
    });

    if (!account) {
      res.status(404).json({
        status: "error",
        message: "Account not found or does not belong to you.",
      });
      return;
    }

    // Prevent closing an account with remaining balance
    if (status === "closed" && Number(account.balance) > 0) {
      res.status(400).json({
        status: "error",
        message: `Cannot close account with a remaining balance of ${account.currency} ${account.balance}. Please withdraw or transfer funds first.`,
      });
      return;
    }

    const updated = await prisma.$transaction(async (tx) => {
      const updatedAccount = await tx.account.update({
        where: { id: req.params.id },
        data: { status },
        select: { id: true, accountNumber: true, accountType: true, status: true },
      });

      await tx.auditLog.create({
        data: {
          userId: req.user!.id,
          action: `ACCOUNT_STATUS_CHANGED:${status.toUpperCase()}`,
          ipAddress: req.ip ?? null,
          userAgent: req.headers["user-agent"] ?? null,
        },
      });

      return updatedAccount;
    });

    const messages: Record<string, string> = {
      active: "Account has been reactivated.",
      frozen: "Account has been frozen. No transactions can be made.",
      closed: "Account has been permanently closed.",
    };

    res.status(200).json({
      status: "success",
      message: messages[status],
      data: { account: updated },
    });
  } catch (error: any) {
    console.error("updateAccountStatus error:", error);
    res.status(500).json({ status: "error", message: "Failed to update account status." });
  }
};
