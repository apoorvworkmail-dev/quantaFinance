import { Request, Response } from "express";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// ── GET /analytics/summary ───────────────────────────────────────────────────
// Returns overall financial summary for the logged-in user
export const getSummary = async (req: Request, res: Response) => {
  const userId = (req as any).user.id;

  try {
    // Get all user accounts
    const accounts = await prisma.account.findMany({
      where: { userId, status: { not: "closed" } },
    });
    const accountIds = accounts.map((a) => a.id);

    const totalBalance = accounts.reduce(
      (sum, a) => sum + Number(a.balance),
      0
    );

    // Total money received (deposits + incoming transfers)
    const totalIn = await prisma.transaction.aggregate({
      where: {
        destinationAccountId: { in: accountIds },
        status: "completed",
      },
      _sum: { amount: true },
    });

    // Total money sent (outgoing transfers)
    const totalOut = await prisma.transaction.aggregate({
      where: {
        sourceAccountId: { in: accountIds },
        status: "completed",
      },
      _sum: { amount: true },
    });

    // Transaction counts
    const txCount = await prisma.transaction.count({
      where: {
        OR: [
          { sourceAccountId: { in: accountIds } },
          { destinationAccountId: { in: accountIds } },
        ],
      },
    });

    const totalInAmt = Number(totalIn._sum.amount ?? 0);
    const totalOutAmt = Number(totalOut._sum.amount ?? 0);
    const savingsRate =
      totalInAmt > 0
        ? Math.max(0, Math.round(((totalInAmt - totalOutAmt) / totalInAmt) * 100))
        : 0;

    res.json({
      status: "success",
      data: {
        totalBalance,
        totalIn: totalInAmt,
        totalOut: totalOutAmt,
        savingsRate,
        txCount,
        accountCount: accounts.length,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ status: "error", message: "Failed to fetch summary." });
  }
};

// ── GET /analytics/monthly ───────────────────────────────────────────────────
// Returns last 6 months of income vs expense aggregated by month
export const getMonthly = async (req: Request, res: Response) => {
  const userId = (req as any).user.id;

  try {
    const accounts = await prisma.account.findMany({
      where: { userId },
      select: { id: true },
    });
    const accountIds = accounts.map((a) => a.id);

    // Build last 6 months labels
    const months: { year: number; month: number; label: string }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      months.push({
        year: d.getFullYear(),
        month: d.getMonth() + 1,
        label: d.toLocaleDateString("en-US", { month: "short", year: "2-digit" }),
      });
    }

    // Fetch all completed transactions in last 6 months for this user
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    const transactions = await prisma.transaction.findMany({
      where: {
        status: "completed",
        createdAt: { gte: sixMonthsAgo },
        OR: [
          { sourceAccountId: { in: accountIds } },
          { destinationAccountId: { in: accountIds } },
        ],
      },
      select: {
        amount: true,
        transactionType: true,
        sourceAccountId: true,
        destinationAccountId: true,
        createdAt: true,
      },
    });

    // Aggregate per month
    const monthlyData = months.map(({ year, month, label }) => {
      const inMonth = transactions.filter((tx) => {
        const d = new Date(tx.createdAt);
        return d.getFullYear() === year && d.getMonth() + 1 === month;
      });

      const income = inMonth
        .filter((tx) => tx.destinationAccountId && accountIds.includes(tx.destinationAccountId))
        .reduce((s, tx) => s + Number(tx.amount), 0);

      const expense = inMonth
        .filter((tx) => tx.sourceAccountId && accountIds.includes(tx.sourceAccountId))
        .reduce((s, tx) => s + Number(tx.amount), 0);

      return { month: label, income: Math.round(income), expense: Math.round(expense) };
    });

    res.json({ status: "success", data: { monthly: monthlyData } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ status: "error", message: "Failed to fetch monthly data." });
  }
};

// ── GET /analytics/breakdown ─────────────────────────────────────────────────
// Returns transaction type breakdown (transfer vs deposit) for pie chart
export const getBreakdown = async (req: Request, res: Response) => {
  const userId = (req as any).user.id;

  try {
    const accounts = await prisma.account.findMany({
      where: { userId },
      select: { id: true },
    });
    const accountIds = accounts.map((a) => a.id);

    const transactions = await prisma.transaction.findMany({
      where: {
        status: "completed",
        OR: [
          { sourceAccountId: { in: accountIds } },
          { destinationAccountId: { in: accountIds } },
        ],
      },
      select: { transactionType: true, amount: true },
    });

    // Group by type
    const grouped: Record<string, number> = {};
    for (const tx of transactions) {
      grouped[tx.transactionType] = (grouped[tx.transactionType] ?? 0) + Number(tx.amount);
    }

    const breakdown = Object.entries(grouped).map(([name, value]) => ({
      name: name.charAt(0).toUpperCase() + name.slice(1),
      value: Math.round(value),
    }));

    res.json({ status: "success", data: { breakdown } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ status: "error", message: "Failed to fetch breakdown." });
  }
};

// ── GET /analytics/recent-activity ──────────────────────────────────────────
// Returns last 30 days daily balance movement
export const getRecentActivity = async (req: Request, res: Response) => {
  const userId = (req as any).user.id;

  try {
    const accounts = await prisma.account.findMany({
      where: { userId },
      select: { id: true },
    });
    const accountIds = accounts.map((a) => a.id);

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const transactions = await prisma.transaction.findMany({
      where: {
        status: "completed",
        createdAt: { gte: thirtyDaysAgo },
        OR: [
          { sourceAccountId: { in: accountIds } },
          { destinationAccountId: { in: accountIds } },
        ],
      },
      select: {
        amount: true,
        sourceAccountId: true,
        destinationAccountId: true,
        createdAt: true,
      },
      orderBy: { createdAt: "asc" },
    });

    // Build daily map for last 14 days
    const days: { date: string; net: number }[] = [];
    for (let i = 13; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const label = d.toLocaleDateString("en-US", { month: "short", day: "numeric" });

      const dayTxs = transactions.filter((tx) => {
        const txDate = new Date(tx.createdAt);
        return (
          txDate.getDate() === d.getDate() &&
          txDate.getMonth() === d.getMonth() &&
          txDate.getFullYear() === d.getFullYear()
        );
      });

      const net = dayTxs.reduce((s, tx) => {
        if (tx.destinationAccountId && accountIds.includes(tx.destinationAccountId))
          return s + Number(tx.amount);
        if (tx.sourceAccountId && accountIds.includes(tx.sourceAccountId))
          return s - Number(tx.amount);
        return s;
      }, 0);

      days.push({ date: label, net: Math.round(net) });
    }

    res.json({ status: "success", data: { activity: days } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ status: "error", message: "Failed to fetch activity." });
  }
};
