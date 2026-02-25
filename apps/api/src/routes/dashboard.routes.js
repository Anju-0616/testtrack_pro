const express = require("express");
const prisma = require("../prisma");
const { authenticate } = require("../middleware/auth");


const router = express.Router();

router.get("/common", authenticate, async (req, res) => {
  try {
    const totalExecutions = await prisma.testExecution.count();

    const passed = await prisma.testExecution.count({
      where: { status: "PASS" }
    });

    const totalBugs = await prisma.bug.count();

    const passRate =
      totalExecutions > 0
        ? Number(((passed / totalExecutions) * 100).toFixed(2))
        : 0;

    // Execution Trend
    const executions = await prisma.testExecution.findMany({
      select: { executedAt: true }
    });

    const trendMap = {};
    executions.forEach(e => {
      const date = e.executedAt.toISOString().split("T")[0];
      trendMap[date] = (trendMap[date] || 0) + 1;
    });

    const executionTrend = Object.entries(trendMap).map(
      ([date, count]) => ({ date, count })
    );

    // Bugs by Status
    const bugStatusRaw = await prisma.bug.groupBy({
      by: ["status"],
      _count: { id: true }
    });

    const bugsByStatus = bugStatusRaw.map(b => ({
      status: b.status,
      count: b._count.id
    }));

    res.json({
      counters: {
        totalExecutions,
        totalBugs,
        passRate
      },
      executionTrend,
      bugsByStatus
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Failed to load common dashboard" });
  }
});

router.get("/tester", authenticate, async (req, res) => {
  console.log("Authorization header:", req.headers.authorization);
  console.log("Decoded user:", req.user);

  try {
    const userId = req.user.userId;

    // Counters
    const myExecutions = await prisma.testExecution.count({
      where: { executedBy: userId }
    });

    const myBugs = await prisma.bug.count({
      where: { createdById: userId }
    });

    const pendingTests = await prisma.testCase.count({
      where: {
        status: "READY",
        executions: {
          none: { executedBy: userId }
        }
      }
    });

    // 📊 Execution Trend
    const executions = await prisma.testExecution.findMany({
      where: { executedBy: userId },
      select: { executedAt: true }
    });

    const trendMap = {};

    executions.forEach(e => {
      if (!e.executedAt) return;
      const date = e.executedAt.toISOString().split("T")[0];
      trendMap[date] = (trendMap[date] || 0) + 1;
    });

    const trend = Object.entries(trendMap).map(([date, count]) => ({
      date,
      count
    }));

    // Recent Failures
    const recentFailures = await prisma.testExecution.findMany({
      where: {
        executedBy: userId,
        status: "FAIL"
      },
      include: {
        testcase: { select: { title: true } }
      },
      orderBy: { executedAt: "desc" },
      take: 5
    });

    res.json({
      counters: {
        myExecutions,
        myBugs,
        pendingTests
      },
      trend,
      recentFailures
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Failed to load tester dashboard" });
  }
});

router.get("/developer", authenticate, async (req, res) => {
  try {
    const userId = req.user.userId;

    // COUNTERS
    const assigned = await prisma.bug.count({
      where: { assignedToId: userId }
    });

    const highPriority = await prisma.bug.count({
      where: {
        assignedToId: userId,
        priority: { in: ["P1_URGENT", "P2_HIGH"] }
      }
    });

    // RECENTLY FIXED
    const recentlyFixed = await prisma.bug.findMany({
      where: {
        assignedToId: userId,
        status: "FIXED"
      },
      orderBy: { resolvedAt: "desc" },
      take: 5
    });

    // STATUS DISTRIBUTION
    const statusRaw = await prisma.bug.groupBy({
      by: ["status"],
      where: { assignedToId: userId },
      _count: { id: true }
    });

    const statusTrend = statusRaw.map(s => ({
      status: s.status,
      count: s._count.id
    }));

    // FIX TREND (Resolved per day)
    const resolvedBugs = await prisma.bug.findMany({
      where: {
        assignedToId: userId,
        resolvedAt: { not: null }
      },
      select: { resolvedAt: true }
    });

    const trendMap = {};

    resolvedBugs.forEach(bug => {
      const date = bug.resolvedAt.toISOString().split("T")[0];
      trendMap[date] = (trendMap[date] || 0) + 1;
    });

    const fixTrend = Object.entries(trendMap).map(([date, count]) => ({
      date,
      count
    }));

    res.json({
      counters: {
        assigned,
        highPriority
      },
      recentlyFixed,
      statusTrend,
      fixTrend
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Failed to load developer dashboard" });
  }
});

router.get("/layout", authenticate, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.userId },
      select: { dashboardLayout: true }
    });

    const layout = user?.dashboardLayout
      ? JSON.parse(user.dashboardLayout)
      : null;

    res.json({ layout });

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Failed to fetch layout" });
  }
});

router.post("/layout", authenticate, async (req, res) => {
  try {
    const { layout } = req.body;

    await prisma.user.update({
      where: { id: req.user.userId },
      data: {
        dashboardLayout: JSON.stringify(layout)
      }
    });

    res.json({ message: "Layout saved successfully" });

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Failed to save layout" });
  }
});

module.exports = router;