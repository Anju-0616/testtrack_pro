const express = require('express');
const prisma = require('../prisma');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

/*
  START EXECUTION
  POST /executions/:testCaseId/start
*/
router.post('/:testCaseId/start', authenticate, async (req, res) => {
  try {
    const testCaseId = parseInt(req.params.testCaseId);

    const execution = await prisma.testExecution.create({
      data: {
        testcaseId: testCaseId,
        executedBy: req.user.userId,
        status: "IN_PROGRESS",
        startedAt: new Date()
      }
    });

    const steps = await prisma.testCaseStep.findMany({
      where: { testCaseId },
      orderBy: { stepNumber: 'asc' }
    });

    const executionSteps = await Promise.all(
      steps.map(step =>
        prisma.executionStep.create({
          data: {
            executionId: execution.id,
            testCaseStepId: step.id
          }
        })
      )
    );

    res.json({ execution, executionSteps });

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Failed to start execution" });
  }
});

/*
  UPDATE STEP RESULT
  PATCH /executions/steps/:stepId
*/
router.patch('/steps/:stepId', authenticate, async (req, res) => {
  try {
    const stepId = parseInt(req.params.stepId);
    const { stepStatus, actualResult } = req.body;

    const updated = await prisma.executionStep.update({
      where: { id: stepId },
      data: {
        stepStatus,
        actualResult
      }
    });

    res.json(updated);

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Failed to update step" });
  }
});

/*
  COMPLETE EXECUTION
  PATCH /executions/:id/complete
*/
router.patch('/:id/complete', authenticate, async (req, res) => {
  try {
    const executionId = parseInt(req.params.id);

    const steps = await prisma.executionStep.findMany({
      where: { executionId }
    });

    let overallStatus = "PASS";

    if (steps.some(s => s.stepStatus === "FAIL")) {
      overallStatus = "FAIL";
    } else if (steps.some(s => s.stepStatus === "BLOCKED")) {
      overallStatus = "BLOCKED";
    }

    const execution = await prisma.testExecution.findUnique({
      where: { id: executionId }
    });

    const completed = await prisma.testExecution.update({
      where: { id: executionId },
      data: {
        status: overallStatus,
        completedAt: new Date(),
        duration: execution.startedAt
          ? Math.floor((new Date() - execution.startedAt) / 1000)
          : null
      }
    });

    res.json(completed);

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Failed to complete execution" });
  }
});

module.exports = router;