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

async function requireMember(projectId, userId, res) {
  const member = await prisma.projectMember.findUnique({
    where: { projectId_userId: { projectId, userId } }
  })
  if (!member) { res.status(403).json({ message: 'Not a member of this project' }); return false }
  return true
}

/**
 * @swagger
 * /testcases:
 *   post:
 *     summary: Create a new test case
 *     tags: [TestCases]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [projectId, title, module]
 *             properties:
 *               projectId:
 *                 type: integer
 *               title:
 *                 type: string
 *               description:
 *                 type: string
 *               module:
 *                 type: string
 *               priority:
 *                 type: string
 *               severity:
 *                 type: string
 *               type:
 *                 type: string
 *               status:
 *                 type: string
 *               tags:
 *                 type: array
 *                 items:
 *                   type: string
 *               steps:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     action:
 *                       type: string
 *                     testData:
 *                       type: string
 *                     expectedResult:
 *                       type: string
 *                     notes:
 *                       type: string
 *     responses:
 *       201:
 *         description: Test case created
 */
// CREATE
router.post('/', authenticate, authorizeRole('TESTER'), async (req, res) => {
  try {
    const {
      projectId, title, description, module, priority, severity, type, status,
      tags, preconditions, testDataRequirements, environmentRequirements,
      postconditions, cleanupSteps, estimatedDuration, automationStatus,
      automationScriptLink, steps = []
    } = req.body

    if (!projectId) return res.status(400).json({ message: 'projectId is required' })
    if (!title || !module) return res.status(400).json({ message: 'Title and module are required' })

    if (!await requireMember(parseInt(projectId), req.user.userId, res)) return

    const testcase = await prisma.testCase.create({
      data: {
        projectId: parseInt(projectId),
        title, description, module,
        priority:                priority             || 'MEDIUM',
        severity:                severity             || 'MAJOR',
        type:                    type                 || 'FUNCTIONAL',
        status:                  status               || 'DRAFT',
        tags:                    tags                 || [],
        preconditions:           preconditions        || null,
        testDataRequirements:    testDataRequirements || null,
        environmentRequirements: environmentRequirements || null,
        postconditions:          postconditions       || null,
        cleanupSteps:            cleanupSteps         || null,
        estimatedDuration:       estimatedDuration ? parseInt(estimatedDuration) : null,
        automationStatus:        automationStatus     || 'NOT_AUTOMATED',
        automationScriptLink:    automationScriptLink || null,
        createdBy:               req.user.userId,
        steps: {
          create: steps.map((s, i) => ({
            stepNumber: i + 1, action: s.action,
            testData: s.testData || null, expectedResult: s.expectedResult, notes: s.notes || null
          }))
        }
      },
      include: { steps: { orderBy: { stepNumber: 'asc' } } }
    })
    res.status(201).json(testcase)
  } catch (err) {
    console.error('CREATE ERROR:', err)
    res.status(500).json({ message: 'Failed to create test case' })
  }
})

/**
 * @swagger
 * /testcases:
 *   get:
 *     summary: Get all test cases with filters and pagination
 *     tags: [TestCases]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: projectId
 *         schema:
 *           type: integer
 *       - in: query
 *         name: priority
 *         schema:
 *           type: string
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *       - in: query
 *         name: module
 *         schema:
 *           type: string
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Paginated list of test cases
 */
// GET ALL
router.get('/', authenticate, async (req, res) => {
  try {
    const { projectId, priority, status, type, module, search, page = 1, limit = 20 } = req.query
    const pageNum  = Math.max(1, parseInt(page))
    const pageSize = Math.min(100, Math.max(1, parseInt(limit)))

    const where = { isDeleted: false }

    if (projectId) {
      if (!await requireMember(parseInt(projectId), req.user.userId, res)) return
      where.projectId = parseInt(projectId)
    } else {
      const memberships = await prisma.projectMember.findMany({
        where:  { userId: req.user.userId },
        select: { projectId: true }
      })
      where.projectId = { in: memberships.map(m => m.projectId) }
    }

    if (priority) where.priority = priority
    if (status)   where.status   = status
    if (type)     where.type     = type
    if (module)   where.module   = module
    if (search)   where.title    = { contains: search, mode: 'insensitive' }

    const [total, cases] = await Promise.all([
      prisma.testCase.count({ where }),
      prisma.testCase.findMany({
        where,
        include: {
          creator: { select: { id: true, name: true, email: true } },
          steps:   { orderBy: { stepNumber: 'asc' } },
          _count:  { select: { executions: true, bugs: true } },
          project: { select: { id: true, name: true, key: true } }
        },
        orderBy: { createdAt: 'desc' },
        skip:    (pageNum - 1) * pageSize,
        take:    pageSize
      })
    ])

    res.json({
      data: cases,
      pagination: { total, page: pageNum, limit: pageSize, totalPages: Math.ceil(total / pageSize) }
    })
  } catch (err) {
    console.error('GET ERROR:', err)
    res.status(500).json({ message: 'Failed to fetch test cases' })
  }
})

/**
 * @swagger
 * /testcases/{id}:
 *   get:
 *     summary: Get test case details
 *     tags: [TestCases]
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
 *         description: Test case details
 *       404:
 *         description: Test case not found
 */
// GET ONE
router.get('/:id', authenticate, async (req, res) => {
  try {
    const id = parseInt(req.params.id)
    const testcase = await prisma.testCase.findFirst({
      where: { id, isDeleted: false },
      include: {
        creator:    { select: { id: true, name: true, email: true } },
        steps:      { orderBy: { stepNumber: 'asc' } },
        executions: { orderBy: { startedAt: 'desc' }, take: 5, include: { tester: { select: { id: true, name: true } } } },
        _count:     { select: { executions: true, bugs: true } },
        project:    { select: { id: true, name: true, key: true } }
      }
    })
    if (!testcase) return res.status(404).json({ message: 'Test case not found' })
    if (!await requireMember(testcase.projectId, req.user.userId, res)) return
    res.json(testcase)
  } catch (err) {
    console.error('GET ONE ERROR:', err)
    res.status(500).json({ message: 'Internal server error' })
  }
})

/**
 * @swagger
 * /testcases/{id}:
 *   put:
 *     summary: Update a test case
 *     tags: [TestCases]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       200:
 *         description: Test case updated
 */
// UPDATE
router.put('/:id', authenticate, authorizeRole('TESTER'), async (req, res) => {
  try {
    const id = parseInt(req.params.id)
    const existing = await prisma.testCase.findFirst({ where: { id, isDeleted: false } })
    if (!existing) return res.status(404).json({ message: 'Test case not found' })
    if (!await requireMember(existing.projectId, req.user.userId, res)) return

    const {
      title, description, module, priority, severity, type, status,
      tags, preconditions, testDataRequirements, environmentRequirements,
      postconditions, cleanupSteps, estimatedDuration, automationStatus,
      automationScriptLink, steps = [], changeSummary
    } = req.body

    const snapshot = await prisma.testCase.findUnique({ where: { id }, include: { steps: true } })

    const updated = await prisma.$transaction(async tx => {
      await tx.testCaseStep.deleteMany({ where: { testCaseId: id } })
      const tc = await tx.testCase.update({
        where: { id },
        data: {
          title, description, module, priority, severity, type, status,
          tags:                    tags                 || [],
          preconditions:           preconditions        || null,
          testDataRequirements:    testDataRequirements || null,
          environmentRequirements: environmentRequirements || null,
          postconditions:          postconditions       || null,
          cleanupSteps:            cleanupSteps         || null,
          estimatedDuration:       estimatedDuration ? parseInt(estimatedDuration) : null,
          automationStatus:        automationStatus     || 'NOT_AUTOMATED',
          automationScriptLink:    automationScriptLink || null,
          version: { increment: 1 },
          steps: {
            create: steps.map((s, i) => ({
              stepNumber: i + 1, action: s.action,
              testData: s.testData || null, expectedResult: s.expectedResult, notes: s.notes || null
            }))
          }
        },
        include: { steps: { orderBy: { stepNumber: 'asc' } } }
      })
      await tx.testCaseHistory.create({
        data: {
          testCaseId:    id,
          version:       tc.version,
          changedBy:     req.user.userId,
          changeSummary: changeSummary || 'Updated',
          snapshot
        }
      })
      return tc
    })
    res.json(updated)
  } catch (err) {
    console.error('UPDATE ERROR:', err)
    res.status(500).json({ message: 'Failed to update test case' })
  }
})

/**
 * @swagger
 * /testcases/{id}:
 *   delete:
 *     summary: Soft delete a test case
 *     tags: [TestCases]
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
 *         description: Test case deleted
 */
// DELETE
router.delete('/:id', authenticate, authorizeRole('TESTER'), async (req, res) => {
  try {
    const id = parseInt(req.params.id)
    const existing = await prisma.testCase.findFirst({ where: { id, isDeleted: false } })
    if (!existing) return res.status(404).json({ message: 'Test case not found' })
    if (!await requireMember(existing.projectId, req.user.userId, res)) return

    await prisma.testCase.update({
      where: { id },
      data: { isDeleted: true, deletedAt: new Date(), deletedBy: req.user.userId }
    })
    res.json({ message: 'Test case deleted' })
  } catch (err) {
    console.error('DELETE ERROR:', err)
    res.status(500).json({ message: 'Failed to delete test case' })
  }
})

/**
 * @swagger
 * /testcases/{id}/clone:
 *   post:
 *     summary: Clone an existing test case
 *     tags: [TestCases]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       201:
 *         description: Test case cloned
 */
// CLONE
router.post('/:id/clone', authenticate, async (req, res) => {
  try {
    const id = parseInt(req.params.id)
    const original = await prisma.testCase.findFirst({
      where: { id, isDeleted: false },
      include: { steps: { orderBy: { stepNumber: 'asc' } } }
    })
    if (!original) return res.status(404).json({ message: 'Test case not found' })
    if (!await requireMember(original.projectId, req.user.userId, res)) return

    const cloned = await prisma.testCase.create({
      data: {
        ...original, id: undefined, createdAt: undefined, updatedAt: undefined,
        title: original.title + ' (Copy)', status: 'DRAFT', version: 1,
        isDeleted: false, deletedAt: null, deletedBy: null,
        createdBy: req.user.userId,
        steps: {
          create: original.steps.map(s => ({
            stepNumber: s.stepNumber, action: s.action,
            testData: s.testData, expectedResult: s.expectedResult, notes: s.notes
          }))
        }
      },
      include: { steps: { orderBy: { stepNumber: 'asc' } } }
    })
    res.status(201).json(cloned)
  } catch (err) {
    console.error('CLONE ERROR:', err)
    res.status(500).json({ message: 'Clone failed' })
  }
})

module.exports = router