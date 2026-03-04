/**
 * @swagger
 * tags:
 *   name: TestCases
 *   description: Test case management APIs
 */

const express = require('express')
const prisma = require('../prisma')
const { authenticate, authorizeRole } = require('../middleware/auth')

const router = express.Router()

console.log("Testcase routes loaded")

/* ============================
   CREATE TESTCASE
============================ */

/**
 * @swagger
 * /test-cases:
 *   post:
 *     summary: Create a new test case (Tester only)
 *     tags: [TestCases]
 *     security:
 *       - bearerAuth: []
 */
router.post('/', authenticate, authorizeRole('TESTER'), async (req, res) => {
  try {
    const { title, description, priority, module } = req.body

    if (!title || !priority || !module) {
      return res.status(400).json({
        message: "Title, priority and module are required"
      })
    }

    const testcase = await prisma.testCase.create({
      data: {
        title,
        description: description || "",
        priority,
        status: "DRAFT",
        module,
        createdBy: req.user.userId
      }
    })

    res.status(201).json(testcase)

  } catch (err) {
    console.error(err)
    res.status(500).json({ message: 'Failed to create test case' })
  }
})

/* ============================
   GET TESTCASES (WITH FILTERS)
============================ */

/**
 * @swagger
 * /test-cases:
 *   get:
 *     summary: Get test cases (filters supported)
 *     tags: [TestCases]
 *     security:
 *       - bearerAuth: []
 */
router.get('/', authenticate, async (req, res) => {
  try {
    const { priority, status } = req.query

    let whereClause = {
      isDeleted: false
    }

    if (priority) whereClause.priority = priority
    if (status) whereClause.status = status

    const cases = await prisma.testCase.findMany({
      where: whereClause,
      orderBy: { createdAt: 'desc' }
    })

    res.json(cases)

  } catch (err) {
    console.error(err)
    res.status(500).json({ message: 'Failed to fetch test cases' })
  }
})

/* ============================
   GET SINGLE TESTCASE
============================ */

/**
 * @swagger
 * /test-cases/{id}:
 *   get:
 *     summary: Get single test case
 *     tags: [TestCases]
 *     security:
 *       - bearerAuth: []
 */
router.get('/:id', authenticate, async (req, res) => {
  try {
    const id = parseInt(req.params.id)

    const testcase = await prisma.testCase.findFirst({
      where: { id, isDeleted: false }
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
   CLONE TESTCASE
============================ */

/**
 * @swagger
 * /test-cases/{id}/clone:
 *   post:
 *     summary: Clone a test case
 *     tags: [TestCases]
 *     security:
 *       - bearerAuth: []
 */
router.post('/:id/clone', authenticate, async (req, res) => {
  try {
    const id = parseInt(req.params.id)

    const original = await prisma.testCase.findFirst({
      where: { id, isDeleted: false }
    })

    if (!original) {
      return res.status(404).json({ message: 'Testcase not found' })
    }

    const cloned = await prisma.testCase.create({
      data: {
        title: original.title + ' (Copy)',
        description: original.description || "",
        priority: original.priority,
        status: "DRAFT",
        module: original.module,
        createdBy: req.user.userId,
        isDeleted: false
      }
    })

    res.status(201).json(cloned)

  } catch (err) {
    console.error("CLONE ERROR:", err)
    res.status(500).json({ message: 'Clone failed' })
  }
})

module.exports = router