import { Response } from "express";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { Decimal } from "@prisma/client/runtime/library";
import prisma from "../config/db";
import { AuthRequest } from "../middleware/auth";

// ── Validation Schemas ───────────────────────────────────────────────────────

const issueCardSchema = z.object({
  accountId: z.string().uuid("Invalid account ID"),
  cardType: z.enum(["debit", "credit"], {
    errorMap: () => ({ message: "Card type must be: debit or credit" }),
  }),
  dailyLimit: z
    .number()
    .positive("Daily limit must be greater than 0")
    .max(100000, "Daily limit cannot exceed 100,000")
    .default(1000),
});

const updateStatusSchema = z.object({
  status: z.enum(["active", "frozen", "blocked"], {
    errorMap: () => ({ message: "Status must be: active, frozen, or blocked" }),
  }),
});

const updateLimitSchema = z.object({
  dailyLimit: z
    .number()
    .positive("Daily limit must be greater than 0")
    .max(100000, "Daily limit cannot exceed 100,000"),
});

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Generates a random 16-digit card number in XXXX-XXXX-XXXX-XXXX format.
 * The actual number is hashed before storage for PCI-DSS compliance.
 */
const generateCardNumber = (): { raw: string; masked: string } => {
  const groups = Array.from({ length: 4 }, () =>
    Math.floor(1000 + Math.random() * 9000).toString()
  );
  const raw = groups.join("");
  const masked = `****-****-****-${groups[3]}`; // show only last 4 digits
  return { raw, masked };
};

/**
 * Generates a future expiry date (3 years from now)
 */
const generateExpiryDate = (): Date => {
  const date = new Date();
  date.setFullYear(date.getFullYear() + 3);
  return date;
};

// ── Controllers ──────────────────────────────────────────────────────────────

/**
 * GET /api/v1/cards
 * Returns all cards belonging to the logged-in user's accounts
 */
export const getMyCards = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    // Get all account IDs for this user
    const userAccounts = await prisma.account.findMany({
      where: { userId: req.user!.id },
      select: { id: true },
    });
    const accountIds = userAccounts.map((a) => a.id);

    const cards = await prisma.card.findMany({
      where: { accountId: { in: accountIds } },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        cardNumberHash: true, // this is the masked number (last 4 only)
        cardType: true,
        status: true,
        expiryDate: true,
        dailyLimit: true,
        createdAt: true,
        account: {
          select: {
            accountNumber: true,
            accountType: true,
            currency: true,
          },
        },
      },
    });

    res.status(200).json({
      status: "success",
      count: cards.length,
      data: { cards },
    });
  } catch (error: any) {
    console.error("getMyCards error:", error);
    res.status(500).json({ status: "error", message: "Failed to fetch cards." });
  }
};

/**
 * POST /api/v1/cards
 * Issues a new virtual card linked to one of the user's accounts
 */
export const issueCard = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const parsed = issueCardSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        status: "error",
        message: "Validation failed",
        errors: parsed.error.flatten().fieldErrors,
      });
      return;
    }

    const { accountId, cardType, dailyLimit } = parsed.data;

    // Verify account belongs to user
    const account = await prisma.account.findFirst({
      where: { id: accountId, userId: req.user!.id },
    });

    if (!account) {
      res.status(404).json({ status: "error", message: "Account not found or does not belong to you." });
      return;
    }

    if (account.status !== "active") {
      res.status(400).json({ status: "error", message: "Cannot issue a card for a frozen or closed account." });
      return;
    }

    // Max 2 cards per account
    const existingCards = await prisma.card.count({
      where: { accountId },
    });

    if (existingCards >= 2) {
      res.status(400).json({
        status: "error",
        message: "Maximum of 2 cards allowed per account.",
      });
      return;
    }

    // Generate card number
    const { raw, masked } = generateCardNumber();

    // Hash the raw card number for storage (PCI-DSS compliance)
    const cardNumberHash = await bcrypt.hash(raw, 10);

    const card = await prisma.$transaction(async (tx) => {
      const newCard = await tx.card.create({
        data: {
          accountId,
          cardNumberHash,        // hashed raw number (for future verification)
          cardType,
          status: "active",
          expiryDate: generateExpiryDate(),
          dailyLimit: new Decimal(dailyLimit),
        },
      });

      // Store masked number back for display (update cardNumberHash to masked)
      const updatedCard = await tx.card.update({
        where: { id: newCard.id },
        data: { cardNumberHash: masked },
      });

      await tx.auditLog.create({
        data: {
          userId: req.user!.id,
          action: `CARD_ISSUED:${cardType.toUpperCase()}:ACCOUNT:${account.accountNumber}`,
          ipAddress: req.ip ?? null,
          userAgent: req.headers["user-agent"] ?? null,
        },
      });

      return updatedCard;
    });

    res.status(201).json({
      status: "success",
      message: `Your ${cardType} card has been issued successfully!`,
      data: {
        card: {
          id: card.id,
          maskedCardNumber: card.cardNumberHash,
          cardType: card.cardType,
          status: card.status,
          expiryDate: card.expiryDate,
          dailyLimit: card.dailyLimit,
          linkedAccount: account.accountNumber,
        },
        // Show full card number ONCE at issuance — store it safely!
        fullCardNumber: raw.replace(/(.{4})/g, "$1-").slice(0, -1),
        notice: "Save your full card number now — it will not be shown again.",
      },
    });
  } catch (error: any) {
    console.error("issueCard error:", error);
    res.status(500).json({ status: "error", message: "Failed to issue card." });
  }
};

/**
 * PATCH /api/v1/cards/:id/status
 * Freeze, unfreeze or permanently block a card
 */
export const updateCardStatus = async (req: AuthRequest, res: Response): Promise<void> => {
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

    // Verify card belongs to user via account ownership
    const userAccounts = await prisma.account.findMany({
      where: { userId: req.user!.id },
      select: { id: true },
    });
    const accountIds = userAccounts.map((a) => a.id);

    const card = await prisma.card.findFirst({
      where: { id: req.params.id, accountId: { in: accountIds } },
    });

    if (!card) {
      res.status(404).json({ status: "error", message: "Card not found or does not belong to you." });
      return;
    }

    // Blocked cards cannot be reactivated
    if (card.status === "blocked") {
      res.status(400).json({
        status: "error",
        message: "This card has been permanently blocked and cannot be modified. Please request a new card.",
      });
      return;
    }

    const updated = await prisma.$transaction(async (tx) => {
      const updatedCard = await tx.card.update({
        where: { id: card.id },
        data: { status },
        select: {
          id: true,
          cardNumberHash: true,
          cardType: true,
          status: true,
          expiryDate: true,
          dailyLimit: true,
        },
      });

      await tx.auditLog.create({
        data: {
          userId: req.user!.id,
          action: `CARD_STATUS_CHANGED:${status.toUpperCase()}:CARD:${card.id}`,
          ipAddress: req.ip ?? null,
          userAgent: req.headers["user-agent"] ?? null,
        },
      });

      return updatedCard;
    });

    const messages: Record<string, string> = {
      active: "Card has been unfrozen and is now active.",
      frozen: "Card has been frozen. No transactions can be made with this card.",
      blocked: "Card has been permanently blocked. You will need to request a new card.",
    };

    res.status(200).json({
      status: "success",
      message: messages[status],
      data: { card: updated },
    });
  } catch (error: any) {
    console.error("updateCardStatus error:", error);
    res.status(500).json({ status: "error", message: "Failed to update card status." });
  }
};

/**
 * PATCH /api/v1/cards/:id/limits
 * Updates the daily spending limit on a card
 */
export const updateCardLimit = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const parsed = updateLimitSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        status: "error",
        message: "Validation failed",
        errors: parsed.error.flatten().fieldErrors,
      });
      return;
    }

    const { dailyLimit } = parsed.data;

    // Verify card belongs to user via account ownership
    const userAccounts = await prisma.account.findMany({
      where: { userId: req.user!.id },
      select: { id: true },
    });
    const accountIds = userAccounts.map((a) => a.id);

    const card = await prisma.card.findFirst({
      where: { id: req.params.id, accountId: { in: accountIds } },
    });

    if (!card) {
      res.status(404).json({ status: "error", message: "Card not found or does not belong to you." });
      return;
    }

    if (card.status === "blocked") {
      res.status(400).json({ status: "error", message: "Cannot modify limits on a blocked card." });
      return;
    }

    const updated = await prisma.$transaction(async (tx) => {
      const updatedCard = await tx.card.update({
        where: { id: card.id },
        data: { dailyLimit: new Decimal(dailyLimit) },
        select: {
          id: true,
          cardNumberHash: true,
          cardType: true,
          status: true,
          dailyLimit: true,
        },
      });

      await tx.auditLog.create({
        data: {
          userId: req.user!.id,
          action: `CARD_LIMIT_UPDATED:${dailyLimit}:CARD:${card.id}`,
          ipAddress: req.ip ?? null,
          userAgent: req.headers["user-agent"] ?? null,
        },
      });

      return updatedCard;
    });

    res.status(200).json({
      status: "success",
      message: `Daily spending limit updated to ${dailyLimit} successfully.`,
      data: { card: updated },
    });
  } catch (error: any) {
    console.error("updateCardLimit error:", error);
    res.status(500).json({ status: "error", message: "Failed to update card limit." });
  }
};
