/**
 * @swagger
 * tags:
 *   name: Dashboard
 *   description: Dashboard & analytics APIs
 */
const express = require("express");
const prisma = require("../prisma");
const { authenticate, authorizeRole } = require("../middleware/auth");

const router = express.Router();

/**
 * @swagger
 * /dashboard/common:
 *   get:
 *     summary: Get common dashboard statistics
 *     description: Returns overall execution metrics, pass rate, bug counts, and trends
 *     tags: [Dashboard]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Common dashboard data
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 counters:
 *                   type: object
 *                   properties:
 *                     totalExecutions:
 *                       type: integer
 *                     totalBugs:
 *                       type: integer
 *                     passRate:
 *                       type: number
 *                 executionTrend:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       date:
 *                         type: string
 *                       count:
 *                         type: integer
 *                 bugsByStatus:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       status:
 *                         type: string
 *                       count:
 *                         type: integer
 */
/* =====================================================
   COMMON DASHBOARD
===================================================== */
router.get("/common", authenticate, async (req, res) => {
  try {
    const totalExecutions = await prisma.testExecution.count();

    const passed = await prisma.testExecution.count({
      where: { status: "PASSED" }
    });

    const totalBugs = await prisma.bug.count();

    const passRate = totalExecutions > 0
      ? Number(((passed / totalExecutions) * 100).toFixed(2))
      : 0;

    const executions = await prisma.testExecution.findMany({
      select: { startedAt: true }
    });

    const trendMap = {};
    executions.forEach(e => {
      const date = e.startedAt.toISOString().split("T")[0];
      trendMap[date] = (trendMap[date] || 0) + 1;
    });

    const executionTrend = Object.entries(trendMap)
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => new Date(a.date) - new Date(b.date));

    const bugStatusRaw = await prisma.bug.groupBy({
      by: ["status"],
      _count: { id: true }
    });

    const bugsByStatus = bugStatusRaw.map(b => ({
      status: b.status,
      count: b._count.id
    }));

    res.json({
      counters: { totalExecutions, totalBugs, passRate },
      executionTrend,
      bugsByStatus
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Failed to load common dashboard" });
  }
});

/**
 * @swagger
 * /dashboard/tester:
 *   get:
 *     summary: Get tester dashboard
 *     description: Provides tester-specific metrics like executions, bugs reported, pending tests, and failures
 *     tags: [Dashboard]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Tester dashboard data
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 counters:
 *                   type: object
 *                   properties:
 *                     myExecutions:
 *                       type: integer
 *                     myBugs:
 *                       type: integer
 *                     pendingTests:
 *                       type: integer
 *                 trend:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       date:
 *                         type: string
 *                       count:
 *                         type: integer
 *                 recentFailures:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       testcase:
 *                         type: object
 *                         properties:
 *                           title:
 *                             type: string
 *                       executedAt:
 *                         type: string
 */
/* =====================================================
   TESTER DASHBOARD
===================================================== */
router.get("/tester", authenticate, authorizeRole("TESTER"), async (req, res) => {
  try {
    const userId = req.user.userId;

    const myExecutions = await prisma.testExecution.count({
      where: { executedBy: userId }
    });

    const myBugs = await prisma.bug.count({
      where: { createdById: userId }
    });

    const pendingTests = await prisma.testCase.count({
      where: {
        status: "APPROVED",
        executions: {
          none: { executedBy: userId }
        }
      }
    });

    const executions = await prisma.testExecution.findMany({
      where: { executedBy: userId },
      select: { startedAt: true }
    });

    const trendMap = {};
    executions.forEach(e => {
      const date = e.startedAt.toISOString().split("T")[0];
      trendMap[date] = (trendMap[date] || 0) + 1;
    });

    const trend = Object.entries(trendMap)
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => new Date(a.date) - new Date(b.date));

    const recentFailures = await prisma.testExecution.findMany({
      where: {
        executedBy: userId,
        status: "FAILED"
      },
      include: {
        testCase: { select: { title: true } }
      },
      orderBy: { startedAt: "desc" },
      take: 5
    });

    const formattedFailures = recentFailures.map(e => ({
      testcase:   { title: e.testCase.title },
      executedAt: e.startedAt,
    }));

    res.json({
      counters: { myExecutions, myBugs, pendingTests },
      trend,
      recentFailures: formattedFailures
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Failed to load tester dashboard" });
  }
});

/**
 * @swagger
 * /dashboard/developer:
 *   get:
 *     summary: Get developer dashboard
 *     description: Provides developer-specific bug metrics and fix trends
 *     tags: [Dashboard]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Developer dashboard data
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 counters:
 *                   type: object
 *                   properties:
 *                     assigned:
 *                       type: integer
 *                     highPriority:
 *                       type: integer
 *                 recentlyFixed:
 *                   type: array
 *                   items:
 *                     type: object
 *                 statusTrend:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       status:
 *                         type: string
 *                       count:
 *                         type: integer
 *                 fixTrend:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       date:
 *                         type: string
 *                       count:
 *                         type: integer
 */
/* =====================================================
   DEVELOPER DASHBOARD
===================================================== */
router.get("/developer", authenticate, authorizeRole("DEVELOPER"), async (req, res) => {
  try {
    const userId = req.user.userId;

    const assigned = await prisma.bug.count({
      where: { assignedToId: userId }
    });

    const highPriority = await prisma.bug.count({
      where: {
        assignedToId: userId,
        priority: { in: ["P1_URGENT", "P2_HIGH"] }
      }
    });

    const recentlyFixed = await prisma.bug.findMany({
      where: {
        assignedToId: userId,
        status: "FIXED"
      },
      orderBy: { resolvedAt: "desc" },
      take: 5
    });

    const statusRaw = await prisma.bug.groupBy({
      by: ["status"],
      where: { assignedToId: userId },
      _count: { id: true }
    });

    const statusTrend = statusRaw.map(s => ({
      status: s.status,
      count: s._count.id
    }));

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

    const fixTrend = Object.entries(trendMap)
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => new Date(a.date) - new Date(b.date));

    res.json({
      counters: { assigned, highPriority },
      recentlyFixed,
      statusTrend,
      fixTrend
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Failed to load developer dashboard" });
  }
});

/**
 * @swagger
 * /dashboard/layout:
 *   get:
 *     summary: Get saved dashboard layout
 *     description: Retrieves the current user's saved dashboard widget layout
 *     tags: [Dashboard]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Dashboard layout data
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 layout:
 *                   type: object
 */
/* =====================================================
   LAYOUT SAVE / LOAD
===================================================== */
router.get("/layout", authenticate, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.userId },
      select: { dashboardLayout: true }
    });
    const layout = user?.dashboardLayout ? JSON.parse(user.dashboardLayout) : null;
    res.json({ layout });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Failed to fetch layout" });
  }
});

router.post("/layout", authenticate, async (req, res) => {
  try {
    const { order, visible } = req.body;
    await prisma.user.update({
      where: { id: req.user.userId },
      data: { dashboardLayout: JSON.stringify({ order, visible }) }
    });
    res.json({ message: "Layout saved successfully" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Failed to save layout" });
  }
});

module.exports = router;