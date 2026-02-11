const express = require('express')
const prisma = require('../prisma')
const { authenticate } = require('../middleware/auth')

const router = express.Router()

console.log("Testcase routes loaded")

/* ============================
   CREATE TESTCASE
   POST /testcases
============================ */
router.post('/', authenticate, async (req, res) => {
  try {
    const { title, description, priority } = req.body

    if (!title) {
      return res.status(400).json({ message: 'Title required' })
    }

    const testcase = await prisma.testCase.create({
      data: {
        title,
        description,
        priority,
        createdBy: req.user.userId
      }
    })

    res.status(201).json(testcase)
  } catch (err) {
    console.error(err)
    res.status(500).json({ message: 'Internal server error' })
  }
})

/* ============================
   LIST TESTCASES (with filters)
   GET /testcases
============================ */
router.get('/', authenticate, async (req, res) => {
  try {
    const { priority, status } = req.query

    const cases = await prisma.testCase.findMany({
      where: {
        isDeleted: false,
        priority: priority || undefined,
        status: status || undefined,
      },
      orderBy: { createdAt: 'desc' },
    })

    res.json(cases)
  } catch (err) {
    console.error(err)
    res.status(500).json({ message: 'Internal server error' })
  }
})

/* ============================
   GET SINGLE TESTCASE
   GET /testcases/:id
============================ */
router.get('/:id', authenticate, async (req, res) => {
  try {
    const id = parseInt(req.params.id)

    const testcase = await prisma.testCase.findFirst({
      where: {
        id,
        isDeleted: false
      }
    })

    if (!testcase) {
      return res.status(404).json({ message: 'Testcase not found' })
    }

    res.json(testcase)
  } catch (err) {
    console.error(err)
    res.status(500).json({ message: 'Internal server error' })
  }
})

/* ============================
   UPDATE TESTCASE
   PUT /testcases/:id
============================ */
router.put('/:id', authenticate, async (req, res) => {
  try {
    const id = parseInt(req.params.id)
    const { title, description, priority } = req.body

    const existing = await prisma.testCase.findFirst({
      where: {
        id,
        isDeleted: false
      }
    })

    if (!existing) {
      return res.status(404).json({ message: 'Testcase not found' })
    }

    const updated = await prisma.testCase.update({
      where: { id },
      data: { title, description, priority }
    })

    res.json(updated)
  } catch (err) {
    console.error(err)
    res.status(500).json({ message: 'Internal server error' })
  }
})

/* ============================
   SOFT DELETE TESTCASE
   DELETE /testcases/:id
============================ */
router.delete('/:id', authenticate, async (req, res) => {
  try {
    const id = parseInt(req.params.id)

    const existing = await prisma.testCase.findUnique({
      where: { id }
    })

    if (!existing || existing.isDeleted) {
      return res.status(404).json({ message: 'Testcase not found' })
    }

    await prisma.testCase.update({
      where: { id },
      data: { isDeleted: true }
    })

    res.json({ message: 'Testcase soft deleted successfully' })
  } catch (err) {
    console.error(err)
    res.status(500).json({ message: 'Internal server error' })
  }
})

/* ============================
   EXECUTE TESTCASE (PASS / FAIL)
   POST /testcases/:id/execute
============================ */
router.post('/:id/execute', authenticate, async (req, res) => {
  try {
    const id = parseInt(req.params.id)
    const { status } = req.body

    if (!["PASS", "FAIL"].includes(status)) {
      return res.status(400).json({ message: "Status must be PASS or FAIL" })
    }

    const testcase = await prisma.testCase.findFirst({
      where: {
        id,
        isDeleted: false
      }
    })

    if (!testcase) {
      return res.status(404).json({ message: "Testcase not found" })
    }

    const execution = await prisma.testExecution.create({
      data: {
        testcaseId: id,
        executedBy: req.user.userId,
        status,
      }
    })

    res.json(execution)
  } catch (err) {
    console.error(err)
    res.status(500).json({ message: "Internal server error" })
  }
})

/* ============================
   GET EXECUTION HISTORY
   GET /testcases/:id/executions
============================ */
router.get('/:id/executions', authenticate, async (req, res) => {
  try {
    const id = parseInt(req.params.id)

    const executions = await prisma.testExecution.findMany({
      where: { testcaseId: id },
      orderBy: { executedAt: 'desc' }
    })

    res.json(executions)
  } catch (err) {
    console.error(err)
    res.status(500).json({ message: "Internal server error" })
  }
})

/* ============================
   CLONE TESTCASE
   POST /testcases/:id/clone
============================ */
router.post('/:id/clone', authenticate, async (req, res) => {
  try {
    const id = parseInt(req.params.id)

    const original = await prisma.testCase.findFirst({
      where: {
        id,
        isDeleted: false
      }
    })

    if (!original) {
      return res.status(404).json({ message: 'Testcase not found' })
    }

    const cloned = await prisma.testCase.create({
      data: {
        title: original.title + ' (Copy)',
        description: original.description,
        priority: original.priority,
        status: original.status,
        createdBy: req.user.userId,
      }
    })

    res.status(201).json(cloned)
  } catch (err) {
    console.error(err)
    res.status(500).json({ message: 'Internal server error' })
  }
})

module.exports = router
