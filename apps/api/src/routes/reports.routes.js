const express = require("express");
const prisma = require("../prisma");

const router = express.Router();
const { authenticate, authorizeRole } = require('../middleware/auth')


router.get("/execution", async (req, res) => {
  try {
    const grouped = await prisma.testExecution.groupBy({
      by: ["status"],
      _count: { id: true },
    });

    const summary = {
      total: 0,
      passed: 0,
      failed: 0,
      blocked: 0,
      skipped: 0,
      passRate: 0,
    };

    grouped.forEach((item) => {
      summary.total += item._count.id;

      if (item.status === "PASS") summary.passed = item._count.id;
      if (item.status === "FAIL") summary.failed = item._count.id;
      if (item.status === "BLOCKED") summary.blocked = item._count.id;
      if (item.status === "SKIPPED") summary.skipped = item._count.id;
    });

    summary.passRate =
      summary.total > 0
        ? Number(((summary.passed / summary.total) * 100).toFixed(2))
        : 0;

        // Breakdown by Tester
const testerGroup = await prisma.testExecution.groupBy({
  by: ["executedBy"],
  _count: { id: true },
});

// Get tester names
const testerIds = testerGroup.map(t => t.executedBy);

const testers = await prisma.user.findMany({
  where: {
    id: { in: testerIds }
  },
  select: {
    id: true,
    email: true
  }
});

// Create map
const testerMap = {};
testers.forEach(t => {
  testerMap[t.id] = t.email;
});

// Final formatted result
const byTester = testerGroup.map(t => ({
  testerId: t.executedBy,
  name: testerMap[t.executedBy] || "Unknown",
  count: t._count.id
}));

// Execution Trend (Date-wise)
const executions = await prisma.testExecution.findMany({
  select: {
    executedAt: true
  }
});

const trendMap = {};

executions.forEach(exec => {
  const date = exec.executedAt.toISOString().split("T")[0];

  if (!trendMap[date]) {
    trendMap[date] = 0;
  }

  trendMap[date]++;
});

const trend = Object.entries(trendMap).map(([date, count]) => ({
  date,
  count
}));

// Execution by Module
const executionsWithModule = await prisma.testExecution.findMany({
  include: {
    testcase: {
      select: {
        module: true
      }
    }
  }
});

const moduleMap = {};

executionsWithModule.forEach(exec => {
  const module = exec.testcase.module;

  if (!moduleMap[module]) {
    moduleMap[module] = 0;
  }

  moduleMap[module]++;
});

const byModule = Object.entries(moduleMap).map(([module, count]) => ({
  module,
  count
}));

// Failed Test Case Details
const failedExecutions = await prisma.testExecution.findMany({
  where: { status: "FAIL" },
  include: {
    testcase: {
      select: {
        id: true,
        title: true,
        module: true
      }
    },
    tester: {
      select: {
        email: true
      }
    }
  },
  orderBy: { executedAt: "desc" }
});

const failedDetails = failedExecutions.map(exec => ({
  executionId: exec.id,
  testcaseId: exec.testcase.id,
  title: exec.testcase.title,
  module: exec.testcase.module,
  executedBy: exec.tester.email,
  executedAt: exec.executedAt
}));

    return res.json({
  summary,
  byTester,
  trend,
  byModule,
  failedDetails
});
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Internal server error" });
  }
});

//get bug reports
// GET /reports/bugs
router.get("/bugs", authenticate, async (req, res) => {
  try {

    // 1️⃣ Bugs by Status
    const byStatusRaw = await prisma.bug.groupBy({
      by: ["status"],
      _count: { id: true }
    });

    const byStatus = byStatusRaw.map(b => ({
      status: b.status,
      count: b._count.id
    }));

    // 2️⃣ Bugs by Severity
    const bySeverityRaw = await prisma.bug.groupBy({
      by: ["severity"],
      _count: { id: true }
    });

    const bySeverity = bySeverityRaw.map(b => ({
      severity: b.severity,
      count: b._count.id
    }));

    // 3️⃣ Bugs by Priority
    const byPriorityRaw = await prisma.bug.groupBy({
      by: ["priority"],
      _count: { id: true }
    });

    const byPriority = byPriorityRaw.map(b => ({
      priority: b.priority,
      count: b._count.id
    }));

    // 4️⃣ Bugs by Developer
    const byDevRaw = await prisma.bug.groupBy({
      by: ["assignedToId"],
      _count: { id: true }
    });

    const devIds = byDevRaw.map(b => b.assignedToId).filter(Boolean);

    const developers = await prisma.user.findMany({
      where: { id: { in: devIds } },
      select: { id: true, email: true }
    });

    const devMap = {};
    developers.forEach(d => devMap[d.id] = d.email);

    const byDeveloper = byDevRaw.map(b => ({
      developerId: b.assignedToId,
      name: devMap[b.assignedToId] || "Unassigned",
      count: b._count.id
    }));

    // Bug Aging
const openBugs = await prisma.bug.findMany({
  where: {
    status: { notIn: ["CLOSED"] }
  },
  select: {
    id: true,
    createdAt: true,
    status: true
  }
});

const aging = openBugs.map(bug => {
  const age = Math.floor(
    (new Date() - new Date(bug.createdAt)) /
    (1000 * 60 * 60 * 24)
  );

  return {
    bugId: bug.id,
    status: bug.status,
    ageInDays: age
  };
});

// Bug Trend (Created per day)
const bugTrendRaw = await prisma.bug.findMany({
  select: { createdAt: true }
});

const trendMap = {};

bugTrendRaw.forEach(bug => {
  const date = bug.createdAt.toISOString().split("T")[0];

  if (!trendMap[date]) {
    trendMap[date] = 0;
  }

  trendMap[date]++;
});

const trend = Object.entries(trendMap).map(([date, count]) => ({
  date,
  count
}));

// Resolution Time Metrics
const resolvedBugs = await prisma.bug.findMany({
  where: {
    resolvedAt: { not: null }
  },
  select: {
    createdAt: true,
    resolvedAt: true
  }
});

let totalResolutionTime = 0;

resolvedBugs.forEach(bug => {
  const resolutionTime =
    (new Date(bug.resolvedAt) - new Date(bug.createdAt)) /
    (1000 * 60 * 60 * 24);

  totalResolutionTime += resolutionTime;
});

const avgResolutionTime =
  resolvedBugs.length > 0
    ? Number((totalResolutionTime / resolvedBugs.length).toFixed(2))
    : 0;

    
    res.json({
      byStatus,
      bySeverity,
      byPriority,
      byDeveloper,
      aging,
      trend,
      avgResolutionTime,
    });

    
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Failed to generate bug report" });
  }
});

router.get("/developer-performance", authenticate, async (req, res) => {
  try {

    const developers = await prisma.user.findMany({
      where: { role: "DEVELOPER" },
      select: { id: true, email: true }
    });

    const performance = [];

    for (const dev of developers) {

      const assigned = await prisma.bug.count({
        where: { assignedToId: dev.id }
      });

      const resolvedBugs = await prisma.bug.findMany({
        where: {
          assignedToId: dev.id,
          resolvedAt: { not: null }
        },
        select: {
          createdAt: true,
          resolvedAt: true
        }
      });

      const resolvedCount = resolvedBugs.length;

      let totalResolutionTime = 0;

      resolvedBugs.forEach(bug => {
        const resolutionTime =
          (new Date(bug.resolvedAt) - new Date(bug.createdAt)) /
          (1000 * 60 * 60 * 24);

        totalResolutionTime += resolutionTime;
      });

      const avgResolutionTime =
        resolvedCount > 0
          ? Number((totalResolutionTime / resolvedCount).toFixed(2))
          : 0;

      const reopenedCount = await prisma.bug.count({
        where: {
          assignedToId: dev.id,
          status: "REOPENED"
        }
      });

      const reopenRate =
        resolvedCount > 0
          ? Number(((reopenedCount / resolvedCount) * 100).toFixed(2))
          : 0;

      const fixQualityScore = 100 - reopenRate;

      performance.push({
        developerId: dev.id,
        name: dev.email,
        bugsAssigned: assigned,
        bugsResolved: resolvedCount,
        avgResolutionTime,
        reopenRate,
        fixQualityScore
      });
    }

    res.json(performance);

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Failed to generate developer report" });
  }
});

module.exports = router;