/**
 * @swagger
 * tags:
 *   name: TestSuites
 *   description: Test suite management APIs
 */

const express = require('express')
const prisma   = require('../prisma')
const { authenticate, authorizeRole } = require('../middleware/auth')

const router = express.Router()

/**
 * @swagger
 * /test-suites:
 *   post:
 *     summary: Create a new test suite
 *     tags: [TestSuites]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *             properties:
 *               name:
 *                 type: string
 *               description:
 *                 type: string
 *               module:
 *                 type: string
 *               parentId:
 *                 type: integer
 *     responses:
 *       201:
 *         description: Test suite created successfully
 */
// ─── CREATE SUITE ─────────────────────────────────────────────────────────────
router.post('/', authenticate, authorizeRole('TESTER'), async (req, res) => {
  try {
    const { name, description, module, parentId } = req.body
    if (!name?.trim()) return res.status(400).json({ message: 'Suite name is required' })

    if (parentId) {
      const parent = await prisma.testSuite.findUnique({ where: { id: parseInt(parentId) } })
      if (!parent) return res.status(404).json({ message: 'Parent suite not found' })
    }

    const suite = await prisma.testSuite.create({
      data: {
        name:        name.trim(),
        description: description?.trim() || null,
        module:      module?.trim()      || null,
        parentId:    parentId ? parseInt(parentId) : null,
        createdBy:   req.user.userId
      },
      include: {
        creator:  { select: { id: true, name: true } },
        children: true,
        _count:   { select: { testCases: true } }
      }
    })

    res.status(201).json(suite)
  } catch (err) {
    console.error('CREATE SUITE ERROR:', err)
    res.status(500).json({ message: 'Failed to create test suite' })
  }
})

/**
 * @swagger
 * /test-suites:
 *   get:
 *     summary: Get all test suites
 *     tags: [TestSuites]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: archived
 *         schema:
 *           type: boolean
 *     responses:
 *       200:
 *         description: List of test suites
 */
// ─── LIST SUITES ──────────────────────────────────────────────────────────────
router.get('/', authenticate, async (req, res) => {
  try {
    const { archived } = req.query
    const suites = await prisma.testSuite.findMany({
      where:   { isArchived: archived === 'true', parentId: null }, // top-level only
      orderBy: { createdAt: 'desc' },
      include: {
        creator:   { select: { id: true, name: true } },
        children:  { include: { _count: { select: { testCases: true } } } },
        testCases: {
          include: {
            testCase: { select: { id: true, title: true, status: true, priority: true } }
          },
          orderBy: { order: 'asc' }
        },
        _count: { select: { testCases: true } }
      }
    })
    res.json(suites)
  } catch (err) {
    console.error('LIST SUITES ERROR:', err)
    res.status(500).json({ message: 'Failed to fetch suites' })
  }
})

/**
 * @swagger
 * /test-suites/{id}:
 *   get:
 *     summary: Get a single test suite
 *     tags: [TestSuites]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Suite details
 *       404:
 *         description: Suite not found
 */
// ─── GET SINGLE SUITE ─────────────────────────────────────────────────────────
router.get('/:id', authenticate, async (req, res) => {
  try {
    const id = parseInt(req.params.id)
    if (isNaN(id)) return res.status(400).json({ message: 'Invalid ID' })

    const suite = await prisma.testSuite.findUnique({
      where:   { id },
      include: {
        creator:  { select: { id: true, name: true } },
        parent:   true,
        children: { include: { _count: { select: { testCases: true } } } },
        testCases: {
          include: {
            testCase: {
              include: { steps: true, _count: { select: { executions: true } } }
            }
          },
          orderBy: { order: 'asc' }
        }
      }
    })

    if (!suite) return res.status(404).json({ message: 'Suite not found' })
    res.json(suite)
  } catch (err) {
    console.error('GET SUITE ERROR:', err)
    res.status(500).json({ message: 'Internal server error' })
  }
})

/**
 * @swagger
 * /test-suites/{id}:
 *   put:
 *     summary: Update a test suite
 *     tags: [TestSuites]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Suite updated successfully
 */
// ─── UPDATE SUITE ─────────────────────────────────────────────────────────────
router.put('/:id', authenticate, authorizeRole('TESTER'), async (req, res) => {
  try {
    const id = parseInt(req.params.id)
    if (isNaN(id)) return res.status(400).json({ message: 'Invalid ID' })

    const existing = await prisma.testSuite.findUnique({ where: { id } })
    if (!existing) return res.status(404).json({ message: 'Suite not found' })

    const { name, description, module, isArchived } = req.body
    const data = {}
    if (name        !== undefined) data.name        = name.trim()
    if (description !== undefined) data.description = description?.trim() || null
    if (module      !== undefined) data.module      = module?.trim()      || null
    if (isArchived  !== undefined) data.isArchived  = Boolean(isArchived)

    const updated = await prisma.testSuite.update({ where: { id }, data })
    res.json(updated)
  } catch (err) {
    console.error('UPDATE SUITE ERROR:', err)
    res.status(500).json({ message: 'Failed to update suite' })
  }
})

/**
 * @swagger
 * /test-suites/{id}/test-cases:
 *   post:
 *     summary: Add test cases to a suite
 *     tags: [TestSuites]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - testCaseIds
 *             properties:
 *               testCaseIds:
 *                 type: array
 *                 items:
 *                   type: integer
 *     responses:
 *       200:
 *         description: Test cases added to suite
 */
// ─── ADD TEST CASES TO SUITE ─────────────────────────────────────────────────
router.post('/:id/test-cases', authenticate, authorizeRole('TESTER'), async (req, res) => {
  try {
    const suiteId = parseInt(req.params.id)
    if (isNaN(suiteId)) return res.status(400).json({ message: 'Invalid suite ID' })

    const { testCaseIds } = req.body
    if (!Array.isArray(testCaseIds) || testCaseIds.length === 0)
      return res.status(400).json({ message: 'testCaseIds array required' })

    const suite = await prisma.testSuite.findUnique({ where: { id: suiteId } })
    if (!suite) return res.status(404).json({ message: 'Suite not found' })

    // Get current max order
    const maxOrder = await prisma.testSuiteCase.aggregate({
      where: { suiteId },
      _max:  { order: true }
    })
    let nextOrder = (maxOrder._max.order ?? -1) + 1

    // Use createMany with skipDuplicates to handle already-added cases
    await prisma.testSuiteCase.createMany({
      data: testCaseIds.map(tcId => ({
        suiteId,
        testCaseId: parseInt(tcId),
        order:      nextOrder++
      })),
      skipDuplicates: true
    })

    const updated = await prisma.testSuite.findUnique({
      where:   { id: suiteId },
      include: {
        testCases: {
          include: { testCase: { select: { id: true, title: true, status: true, priority: true } } },
          orderBy: { order: 'asc' }
        },
        _count: { select: { testCases: true } }
      }
    })

    res.json(updated)
  } catch (err) {
    console.error('ADD CASES TO SUITE ERROR:', err)
    res.status(500).json({ message: 'Failed to add test cases' })
  }
})

/**
 * @swagger
 * /test-suites/{id}/test-cases/{testCaseId}:
 *   delete:
 *     summary: Remove test case from suite
 *     tags: [TestSuites]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *       - in: path
 *         name: testCaseId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Test case removed from suite
 */
// ─── REMOVE TEST CASE FROM SUITE ─────────────────────────────────────────────
router.delete('/:id/test-cases/:testCaseId', authenticate, authorizeRole('TESTER'), async (req, res) => {
  try {
    const suiteId    = parseInt(req.params.id)
    const testCaseId = parseInt(req.params.testCaseId)

    await prisma.testSuiteCase.deleteMany({ where: { suiteId, testCaseId } })
    res.json({ message: 'Test case removed from suite' })
  } catch (err) {
    console.error('REMOVE FROM SUITE ERROR:', err)
    res.status(500).json({ message: 'Failed to remove test case' })
  }
})

/**
 * @swagger
 * /test-suites/{id}:
 *   delete:
 *     summary: Archive a test suite
 *     tags: [TestSuites]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Suite archived successfully
 */
// ─── DELETE SUITE ─────────────────────────────────────────────────────────────
router.delete('/:id', authenticate, authorizeRole('TESTER'), async (req, res) => {
  try {
    const id = parseInt(req.params.id)
    if (isNaN(id)) return res.status(400).json({ message: 'Invalid ID' })

    const suite = await prisma.testSuite.findUnique({ where: { id } })
    if (!suite) return res.status(404).json({ message: 'Suite not found' })

    // Archive instead of hard delete to preserve history
    await prisma.testSuite.update({ where: { id }, data: { isArchived: true } })
    res.json({ message: 'Suite archived successfully' })
  } catch (err) {
    console.error('DELETE SUITE ERROR:', err)
    res.status(500).json({ message: 'Failed to archive suite' })
  }
})

module.exports = router