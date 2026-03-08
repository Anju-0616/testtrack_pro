const express = require('express')
const prisma  = require('../prisma')
const { authenticate } = require('../middleware/auth')

const router = express.Router()

// ── START / CREATE EXECUTION ──────────────────────────────────────────────────
router.post('/', authenticate, async (req, res) => {
  try {
    const { testCaseId, testRunId } = req.body
    if (!testCaseId) return res.status(400).json({ message: 'testCaseId is required' })

    const testCase = await prisma.testCase.findFirst({
      where: { id: parseInt(testCaseId), isDeleted: false },
      include: { steps: { orderBy: { stepNumber: 'asc' } } }
    })
    if (!testCase) return res.status(404).json({ message: 'Test case not found' })

    const execution = await prisma.testExecution.create({
      data: {
        testCaseId: parseInt(testCaseId),
        testRunId:  testRunId ? parseInt(testRunId) : null,
        executedBy: req.user.userId,
        status:     'IN_PROGRESS',
        startedAt:  new Date()
      },
      include: { testCase: { select: { id: true, title: true, module: true } } }
    })

    // Pre-create PENDING step results
    await prisma.stepResult.createMany({
      data: testCase.steps.map(s => ({
        executionId: execution.id,
        stepId:      s.id,
        status:      'PENDING'
      }))
    })

    const fullExecution = await prisma.testExecution.findUnique({
      where: { id: execution.id },
      include: {
        testCase:    { include: { steps: { orderBy: { stepNumber: 'asc' } } } },
        stepResults: true
      }
    })

    res.status(201).json(fullExecution)
  } catch (err) {
    console.error('START EXECUTION ERROR:', err)
    res.status(500).json({ message: 'Failed to start execution' })
  }
})

// ── UPDATE STEP RESULT ────────────────────────────────────────────────────────
router.put('/:executionId/steps/:stepId', authenticate, async (req, res) => {
  try {
    const executionId = parseInt(req.params.executionId)
    const stepId      = parseInt(req.params.stepId)
    const { status, actualResult, notes } = req.body

    const updated = await prisma.stepResult.upsert({
      where:  { executionId_stepId: { executionId, stepId } },
      create: { executionId, stepId, status, actualResult: actualResult || null, notes: notes || null },
      update: { status, actualResult: actualResult || null, notes: notes || null }
    })

    res.json(updated)
  } catch (err) {
    console.error('UPDATE STEP ERROR:', err)
    res.status(500).json({ message: 'Failed to update step' })
  }
})

// ── COMPLETE EXECUTION ────────────────────────────────────────────────────────
router.put('/:id/complete', authenticate, async (req, res) => {
  try {
    const id       = parseInt(req.params.id)
    const { timeSpent } = req.body

    const stepResults = await prisma.stepResult.findMany({ where: { executionId: id } })

    let overallStatus = 'PASSED'
    if (stepResults.some(s => s.status === 'FAIL'))    overallStatus = 'FAILED'
    else if (stepResults.some(s => s.status === 'BLOCKED')) overallStatus = 'BLOCKED'
    else if (stepResults.some(s => s.status === 'SKIPPED')) overallStatus = 'SKIPPED'

    const completed = await prisma.testExecution.update({
      where: { id },
      data: {
        status:      overallStatus,
        completedAt: new Date(),
        timeSpent:   timeSpent ? parseInt(timeSpent) : null
      }
    })

    res.json(completed)
  } catch (err) {
    console.error('COMPLETE EXECUTION ERROR:', err)
    res.status(500).json({ message: 'Failed to complete execution' })
  }
})

// ── GET EXECUTION ─────────────────────────────────────────────────────────────
router.get('/:id', authenticate, async (req, res) => {
  try {
    const id = parseInt(req.params.id)
    const execution = await prisma.testExecution.findUnique({
      where: { id },
      include: {
        testCase:    { include: { steps: { orderBy: { stepNumber: 'asc' } } } },
        stepResults: true,
        tester:      { select: { id: true, name: true } }
      }
    })
    if (!execution) return res.status(404).json({ message: 'Execution not found' })
    res.json(execution)
  } catch (err) {
    console.error('GET EXECUTION ERROR:', err)
    res.status(500).json({ message: 'Internal server error' })
  }
})

module.exports = router