import { Response } from "express";
import { z } from "zod";
import prisma from "../config/db";
import { AuthRequest } from "../middleware/auth";

// ── Validation Schemas ───────────────────────────────────────────────────────

const userStatusSchema = z.object({
  status: z.enum(["active", "suspended"], {
    errorMap: () => ({ message: "Status must be: active or suspended" }),
  }),
  reason: z.string().max(300).optional(),
});

const paginationSchema = z.object({
  page: z.string().transform(Number).default("1"),
  limit: z.string().transform(Number).default("20"),
  search: z.string().optional(),
  role: z.enum(["customer", "teller", "admin"]).optional(),
  status: z.string().optional(),
});

// ── Controllers ──────────────────────────────────────────────────────────────

/**
 * GET /api/v1/admin/stats
 * Returns system-wide overview stats for the admin dashboard
 */
export const getStats = async (_req: AuthRequest, res: Response): Promise<void> => {
  try {
    const [
      totalUsers,
      activeUsers,
      suspendedUsers,
      totalAccounts,
      frozenAccounts,
      totalTransactions,
      completedTransactions,
      failedTransactions,
      totalCards,
      frozenCards,
      blockedCards,
    ] = await prisma.$transaction([
      prisma.user.count(),
      prisma.user.count({ where: { status: "active" } }),
      prisma.user.count({ where: { status: "suspended" } }),
      prisma.account.count(),
      prisma.account.count({ where: { status: "frozen" } }),
      prisma.transaction.count(),
      prisma.transaction.count({ where: { status: "completed" } }),
      prisma.transaction.count({ where: { status: "failed" } }),
      prisma.card.count(),
      prisma.card.count({ where: { status: "frozen" } }),
      prisma.card.count({ where: { status: "blocked" } }),
    ]);

    // Total volume of completed transfers + deposits
    const volumeResult = await prisma.transaction.aggregate({
      _sum: { amount: true },
      where: { status: "completed" },
    });

    // Recent activity — last 5 transactions
    const recentTransactions = await prisma.transaction.findMany({
      orderBy: { createdAt: "desc" },
      take: 5,
      select: {
        id: true,
        amount: true,
        currency: true,
        transactionType: true,
        status: true,
        createdAt: true,
        sourceAccount: { select: { accountNumber: true } },
        destinationAccount: { select: { accountNumber: true } },
      },
    });

    res.status(200).json({
      status: "success",
      data: {
        users: { total: totalUsers, active: activeUsers, suspended: suspendedUsers },
        accounts: { total: totalAccounts, frozen: frozenAccounts },
        transactions: {
          total: totalTransactions,
          completed: completedTransactions,
          failed: failedTransactions,
          totalVolume: volumeResult._sum.amount ?? 0,
        },
        cards: { total: totalCards, frozen: frozenCards, blocked: blockedCards },
        recentTransactions,
      },
    });
  } catch (error: any) {
    console.error("getStats error:", error);
    res.status(500).json({ status: "error", message: "Failed to fetch system stats." });
  }
};

/**
 * GET /api/v1/admin/users
 * Returns paginated list of all users with optional search and filters
 */
export const getAllUsers = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const parsed = paginationSchema.safeParse(req.query);
    if (!parsed.success) {
      res.status(400).json({ status: "error", message: "Invalid query parameters." });
      return;
    }

    const { page, limit, search, role, status } = parsed.data;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (role) where.role = role;
    if (status) where.status = status;
    if (search) {
      where.OR = [
        { email: { contains: search } },
        { firstName: { contains: search } },
        { lastName: { contains: search } },
      ];
    }

    const [users, total] = await prisma.$transaction([
      prisma.user.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          phoneNumber: true,
          role: true,
          status: true,
          createdAt: true,
          _count: {
            select: { accounts: true },
          },
        },
      }),
      prisma.user.count({ where }),
    ]);

    res.status(200).json({
      status: "success",
      data: {
        users,
        pagination: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit),
        },
      },
    });
  } catch (error: any) {
    console.error("getAllUsers error:", error);
    res.status(500).json({ status: "error", message: "Failed to fetch users." });
  }
};

/**
 * GET /api/v1/admin/users/:id
 * Returns full profile of a specific user with accounts and recent transactions
 */
export const getUserById = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.params.id },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        phoneNumber: true,
        role: true,
        status: true,
        createdAt: true,
        accounts: {
          select: {
            id: true,
            accountNumber: true,
            accountType: true,
            balance: true,
            currency: true,
            status: true,
            createdAt: true,
            cards: {
              select: {
                id: true,
                cardType: true,
                status: true,
                dailyLimit: true,
                expiryDate: true,
              },
            },
          },
        },
        auditLogs: {
          orderBy: { createdAt: "desc" },
          take: 10,
          select: {
            id: true,
            action: true,
            ipAddress: true,
            createdAt: true,
          },
        },
      },
    });

    if (!user) {
      res.status(404).json({ status: "error", message: "User not found." });
      return;
    }

    res.status(200).json({ status: "success", data: { user } });
  } catch (error: any) {
    console.error("getUserById error:", error);
    res.status(500).json({ status: "error", message: "Failed to fetch user." });
  }
};

/**
 * PATCH /api/v1/admin/users/:id/status
 * Suspend or reactivate a user account
 */
export const updateUserStatus = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const parsed = userStatusSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        status: "error",
        message: "Validation failed",
        errors: parsed.error.flatten().fieldErrors,
      });
      return;
    }

    const { status, reason } = parsed.data;

    // Prevent admin from suspending themselves
    if (req.params.id === req.user!.id) {
      res.status(400).json({ status: "error", message: "You cannot change your own account status." });
      return;
    }

    const target = await prisma.user.findUnique({ where: { id: req.params.id } });
    if (!target) {
      res.status(404).json({ status: "error", message: "User not found." });
      return;
    }

    const updated = await prisma.$transaction(async (tx) => {
      const updatedUser = await tx.user.update({
        where: { id: req.params.id },
        data: { status },
        select: { id: true, firstName: true, lastName: true, email: true, status: true },
      });

      await tx.auditLog.create({
        data: {
          userId: req.user!.id,
          action: `ADMIN:USER_STATUS_CHANGED:${status.toUpperCase()}:TARGET:${req.params.id}${reason ? `:REASON:${reason}` : ""}`,
          ipAddress: req.ip ?? null,
          userAgent: req.headers["user-agent"] ?? null,
        },
      });

      return updatedUser;
    });

    const messages: Record<string, string> = {
      active: `User ${updated.email} has been reactivated.`,
      suspended: `User ${updated.email} has been suspended.`,
    };

    res.status(200).json({
      status: "success",
      message: messages[status],
      data: { user: updated },
    });
  } catch (error: any) {
    console.error("updateUserStatus error:", error);
    res.status(500).json({ status: "error", message: "Failed to update user status." });
  }
};

/**
 * GET /api/v1/admin/transactions
 * Returns all transactions across the system with filters and pagination
 */
export const getAllTransactions = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const parsed = z.object({
      page: z.string().transform(Number).default("1"),
      limit: z.string().transform(Number).default("20"),
      type: z.enum(["transfer", "deposit", "withdrawal"]).optional(),
      status: z.enum(["pending", "completed", "failed", "reversed"]).optional(),
      from: z.string().optional(),
      to: z.string().optional(),
    }).safeParse(req.query);

    if (!parsed.success) {
      res.status(400).json({ status: "error", message: "Invalid query parameters." });
      return;
    }

    const { page, limit, type, status, from, to } = parsed.data;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (type) where.transactionType = type;
    if (status) where.status = status;
    if (from || to) {
      where.createdAt = {};
      if (from) where.createdAt.gte = new Date(from);
      if (to) where.createdAt.lte = new Date(to);
    }

    const [transactions, total] = await prisma.$transaction([
      prisma.transaction.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          amount: true,
          currency: true,
          transactionType: true,
          status: true,
          referenceDescription: true,
          createdAt: true,
          sourceAccount: {
            select: {
              accountNumber: true,
              user: { select: { firstName: true, lastName: true, email: true } },
            },
          },
          destinationAccount: {
            select: {
              accountNumber: true,
              user: { select: { firstName: true, lastName: true, email: true } },
            },
          },
        },
      }),
      prisma.transaction.count({ where }),
    ]);

    res.status(200).json({
      status: "success",
      data: {
        transactions,
        pagination: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit),
        },
      },
    });
  } catch (error: any) {
    console.error("getAllTransactions error:", error);
    res.status(500).json({ status: "error", message: "Failed to fetch transactions." });
  }
};

/**
 * GET /api/v1/admin/audit-logs
 * Returns paginated system-wide audit logs
 */
export const getAuditLogs = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const parsed = z.object({
      page: z.string().transform(Number).default("1"),
      limit: z.string().transform(Number).default("30"),
      userId: z.string().optional(),
      action: z.string().optional(),
    }).safeParse(req.query);

    if (!parsed.success) {
      res.status(400).json({ status: "error", message: "Invalid query parameters." });
      return;
    }

    const { page, limit, userId, action } = parsed.data;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (userId) where.userId = userId;
    if (action) where.action = { contains: action };

    const [logs, total] = await prisma.$transaction([
      prisma.auditLog.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          action: true,
          ipAddress: true,
          userAgent: true,
          createdAt: true,
          user: {
            select: { id: true, firstName: true, lastName: true, email: true, role: true },
          },
        },
      }),
      prisma.auditLog.count({ where }),
    ]);

    res.status(200).json({
      status: "success",
      data: {
        logs,
        pagination: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit),
        },
      },
    });
  } catch (error: any) {
    console.error("getAuditLogs error:", error);
    res.status(500).json({ status: "error", message: "Failed to fetch audit logs." });
  }
};

/**
 * DELETE /api/v1/admin/users/:id
 * Permanently deletes a user from the system
 */
export const deleteUser = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const existing = await prisma.user.findUnique({ where: { id } });
    if (!existing) {
      res.status(404).json({ status: "error", message: "User not found." });
      return;
    }

    await prisma.user.delete({ where: { id } });

    await prisma.auditLog.create({
      data: {
        userId: req.user!.id,
        action: `ADMIN_DELETED_USER`,
        metadata: JSON.stringify({ deletedUserId: id, email: existing.email }),
        ipAddress: req.ip ?? null,
        userAgent: req.headers["user-agent"] ?? null,
      },
    });

    res.status(200).json({ status: "success", message: "User permanently deleted." });
  } catch (error: any) {
    res.status(500).json({ status: "error", message: "Failed to delete user." });
  }
};

/**
 * PATCH /api/v1/admin/users/:id/verify
 * Approves a user's KYC verification status
 */
export const verifyUserKYC = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { status } = req.body; // e.g. "verified", "pending_kyc"

    if (!["verified", "pending_kyc"].includes(status)) {
      res.status(400).json({ status: "error", message: "Invalid status value." });
      return;
    }

    const existing = await prisma.user.findUnique({ where: { id } });
    if (!existing) {
      res.status(404).json({ status: "error", message: "User not found." });
      return;
    }

    await prisma.user.update({
      where: { id },
      data: { status },
    });

    await prisma.auditLog.create({
      data: {
        userId: req.user!.id,
        action: `ADMIN_USER_KYC_UPDATE`,
        metadata: JSON.stringify({ targetUserId: id, status }),
        ipAddress: req.ip ?? null,
        userAgent: req.headers["user-agent"] ?? null,
      },
    });

    res.status(200).json({ status: "success", message: `User KYC status updated to ${status}.` });
  } catch (error: any) {
    res.status(500).json({ status: "error", message: "Failed to update user KYC status." });
  }
};

/**
 * PATCH /api/v1/admin/accounts/:id/status
 * Freezes, closes, or activates any user account
 */
export const freezeAccountByAdmin = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { status } = req.body; // active, frozen, closed

    if (!["active", "frozen", "closed"].includes(status)) {
      res.status(400).json({ status: "error", message: "Invalid status value." });
      return;
    }

    const account = await prisma.account.findUnique({ where: { id } });
    if (!account) {
      res.status(404).json({ status: "error", message: "Account not found." });
      return;
    }

    await prisma.account.update({
      where: { id },
      data: { status },
    });

    await prisma.auditLog.create({
      data: {
        userId: req.user!.id,
        action: `ADMIN_ACCOUNT_STATUS_CHANGE`,
        metadata: JSON.stringify({ accountId: id, status }),
        ipAddress: req.ip ?? null,
        userAgent: req.headers["user-agent"] ?? null,
      },
    });

    res.status(200).json({ status: "success", message: `Account status updated to ${status}.` });
  } catch (error: any) {
    res.status(500).json({ status: "error", message: "Failed to update account status." });
  }
};

/**
 * POST /api/v1/admin/transactions/:id/reverse
 * Reverses a transaction and restores account balances atomically
 */
export const reverseTransaction = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const tx = await prisma.transaction.findUnique({
      where: { id },
      include: {
        sourceAccount: true,
        destinationAccount: true,
      },
    });

    if (!tx) {
      res.status(404).json({ status: "error", message: "Transaction not found." });
      return;
    }

    if (tx.status !== "completed") {
      res.status(400).json({ status: "error", message: "Only completed transactions can be reversed." });
      return;
    }

    // Atomically reverse transaction
    await prisma.$transaction(async (prismaTx) => {
      // 1. If it was a transfer, debit destination, credit source
      if (tx.transactionType === "transfer") {
        if (tx.sourceAccountId) {
          await prismaTx.account.update({
            where: { id: tx.sourceAccountId },
            data: { balance: { increment: tx.amount } },
          });
        }
        if (tx.destinationAccountId) {
          await prismaTx.account.update({
            where: { id: tx.destinationAccountId },
            data: { balance: { decrement: tx.amount } },
          });
        }
      } 
      // 2. If it was a deposit, debit destination
      else if (tx.transactionType === "deposit") {
        if (tx.destinationAccountId) {
          await prismaTx.account.update({
            where: { id: tx.destinationAccountId },
            data: { balance: { decrement: tx.amount } },
          });
        }
      }

      // 3. Mark transaction as reversed
      await prismaTx.transaction.update({
        where: { id },
        data: {
          status: "reversed",
          reversedById: req.user!.id,
          reversedAt: new Date(),
        },
      });

      // 4. Log audit log
      await prismaTx.auditLog.create({
        data: {
          userId: req.user!.id,
          action: "ADMIN_REVERSED_TRANSACTION",
          metadata: JSON.stringify({ transactionId: id, amount: tx.amount, type: tx.transactionType }),
          ipAddress: req.ip ?? null,
          userAgent: req.headers["user-agent"] ?? null,
        },
      });
    });

    res.status(200).json({ status: "success", message: "Transaction reversed successfully." });
  } catch (error: any) {
    console.error("reverseTransaction error:", error);
    res.status(500).json({ status: "error", message: "Failed to reverse transaction." });
  }
};

/**
 * GET /api/v1/admin/loans
 * Returns all loans with pagination and filters
 */
export const getAllLoans = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const parsed = paginationSchema.safeParse(req.query);
    if (!parsed.success) {
      res.status(400).json({ status: "error", message: "Invalid query parameters." });
      return;
    }

    const { page, limit, status } = parsed.data;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (status) where.status = status;

    const [loans, total] = await prisma.$transaction([
      prisma.loan.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: {
          user: { select: { firstName: true, lastName: true, email: true } },
        },
      }),
      prisma.loan.count({ where }),
    ]);

    res.status(200).json({
      status: "success",
      data: {
        loans,
        pagination: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit),
        },
      },
    });
  } catch (error: any) {
    console.error("getAllLoans error:", error);
    res.status(500).json({ status: "error", message: "Failed to fetch loans." });
  }
};

/**
 * PATCH /api/v1/admin/loans/:id/status
 * Approve or reject a loan
 */
export const approveRejectLoan = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!["approved", "rejected"].includes(status)) {
      res.status(400).json({ status: "error", message: "Status must be approved or rejected." });
      return;
    }

    const loan = await prisma.loan.findUnique({ where: { id } });
    if (!loan) {
      res.status(404).json({ status: "error", message: "Loan not found." });
      return;
    }

    if (loan.status !== "pending") {
      res.status(400).json({ status: "error", message: "Only pending loans can be approved or rejected." });
      return;
    }

    await prisma.$transaction(async (tx) => {
      await tx.loan.update({
        where: { id },
        data: { status: status === "approved" ? "active" : "rejected" },
      });

      // If approved, disperse funds if linkedAccountId is present
      if (status === "approved" && loan.linkedAccountId) {
        const account = await tx.account.findUnique({ where: { id: loan.linkedAccountId } });
        if (account) {
          await tx.account.update({
            where: { id: loan.linkedAccountId },
            data: { balance: { increment: loan.principalAmount } },
          });

          await tx.transaction.create({
            data: {
              destinationAccountId: loan.linkedAccountId,
              amount: loan.principalAmount,
              currency: account.currency,
              transactionType: "deposit",
              status: "completed",
              referenceDescription: `Loan Disbursement for ${loan.id}`,
            },
          });
        }
      }

      await tx.auditLog.create({
        data: {
          userId: req.user!.id,
          action: `ADMIN_${status.toUpperCase()}_LOAN`,
          metadata: JSON.stringify({ loanId: id }),
          ipAddress: req.ip ?? null,
          userAgent: req.headers["user-agent"] ?? null,
        },
      });
    });

    res.status(200).json({ status: "success", message: `Loan ${status} successfully.` });
  } catch (error: any) {
    console.error("approveRejectLoan error:", error);
    res.status(500).json({ status: "error", message: "Failed to update loan status." });
  }
};

