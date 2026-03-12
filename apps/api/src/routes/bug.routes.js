/**
 * @swagger
 * tags:
 *   name: Bugs
 *   description: Bug lifecycle management APIs
 */

const express = require('express')
const prisma = require('../prisma')
const { authenticate, authorizeRole } = require('../middleware/auth')
const { createBugSchema } = require('../validators/bug.schema')
const {
  createNotification,
  notifyBugTransition,
  notifyBugAssigned,
  notifyBugComment
} = require('../services/notification.service')

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
 * /bugs:
 *   post:
 *     summary: Create a new bug
 *     tags: [Bugs]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - projectId
 *               - title
 *               - description
 *               - severity
 *               - priority
 *             properties:
 *               projectId:
 *                 type: integer
 *               title:
 *                 type: string
 *               description:
 *                 type: string
 *               stepsToReproduce:
 *                 type: string
 *               expectedBehavior:
 *                 type: string
 *               actualBehavior:
 *                 type: string
 *               severity:
 *                 type: string
 *                 example: MAJOR
 *               priority:
 *                 type: string
 *                 example: P2_HIGH
 *               assignedToId:
 *                 type: integer
 *     responses:
 *       201:
 *         description: Bug created successfully
 *       400:
 *         description: Validation error
 */
// ── CREATE BUG ────────────────────────────────────────────────────────────────
router.post('/', authenticate, authorizeRole('TESTER'), async (req, res) => {
  try {
    const parsed = createBugSchema.parse(req.body)
    const projectId = parseInt(req.body.projectId)
    if (!projectId) return res.status(400).json({ message: 'projectId is required' })
    if (!await requireMember(projectId, req.user.userId, res)) return

    const project = await prisma.project.findUnique({ where: { id: projectId } })
    if (!project) return res.status(404).json({ message: 'Project not found' })

    const count = await prisma.bug.count({ where: { projectId } })
    const bugId = `${project.key}-BUG-${String(count + 1).padStart(4, '0')}`

    const bug = await prisma.bug.create({
      data: { bugId, projectId, ...parsed, createdById: req.user.userId }
    })

    // Notify assigned developer immediately on creation (if pre-assigned)
    if (bug.assignedToId) {
      await notifyBugAssigned({ bug, assignedToId: bug.assignedToId, actorId: req.user.userId })
    }

    res.status(201).json(bug)
  } catch (error) {
    if (error.name === 'ZodError') return res.status(400).json({ message: 'Validation failed', errors: error.errors })
    console.error('CREATE BUG ERROR:', error)
    res.status(500).json({ message: 'Failed to create bug' })
  }
})

/**
 * @swagger
 * /bugs:
 *   get:
 *     summary: Get all bugs for a project
 *     tags: [Bugs]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: projectId
 *         required: true
 *         schema:
 *           type: integer
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *       - in: query
 *         name: priority
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
 *         description: List of bugs
 */
// ── GET ALL BUGS (scoped to project) ─────────────────────────────────────────
router.get('/', authenticate, async (req, res) => {
  try {
    const { projectId, status, priority, search, page = 1, limit = 20 } = req.query
    if (!projectId) return res.status(400).json({ message: 'projectId is required' })
    if (!await requireMember(parseInt(projectId), req.user.userId, res)) return

    const pageNum  = Math.max(1, parseInt(page))
    const pageSize = Math.min(100, Math.max(1, parseInt(limit)))
    const where    = { projectId: parseInt(projectId) }
    if (status)   where.status   = status
    if (priority) where.priority = priority
    if (search)   where.title    = { contains: search, mode: 'insensitive' }

    const [total, bugs] = await Promise.all([
      prisma.bug.count({ where }),
      prisma.bug.findMany({
        where,
        include: {
          createdBy:  { select: { id: true, name: true, email: true } },
          assignedTo: { select: { id: true, name: true, email: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (pageNum - 1) * pageSize,
        take: pageSize
      })
    ])

    res.json({ data: bugs, pagination: { total, page: pageNum, limit: pageSize, totalPages: Math.ceil(total / pageSize) } })
  } catch (error) {
    console.error('GET BUGS ERROR:', error)
    res.status(500).json({ message: 'Failed to fetch bugs' })
  }
})

/**
 * @swagger
 * /bugs/{id}:
 *   get:
 *     summary: Get a single bug by ID
 *     tags: [Bugs]
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
 *         description: Bug details returned
 *       404:
 *         description: Bug not found
 */
// ── GET SINGLE BUG ────────────────────────────────────────────────────────────
router.get('/:id', authenticate, async (req, res) => {
  try {
    const id  = parseInt(req.params.id)
    const bug = await prisma.bug.findUnique({
      where: { id },
      include: {
        createdBy:  { select: { id: true, name: true, email: true } },
        assignedTo: { select: { id: true, name: true, email: true } },
        testCase:   { select: { id: true, title: true } },
        comments: {
          include: { user: { select: { id: true, name: true, role: true } } },
          orderBy: { createdAt: 'asc' }
        }
      }
    })
    if (!bug) return res.status(404).json({ message: 'Bug not found' })
    if (!await requireMember(bug.projectId, req.user.userId, res)) return
    res.json(bug)
  } catch (error) {
    console.error('GET BUG ERROR:', error)
    res.status(500).json({ message: 'Internal server error' })
  }
})

/**
 * @swagger
 * /bugs/{id}/assign:
 *   patch:
 *     summary: Assign bug to a developer
 *     tags: [Bugs]
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
 *               - assignedToId
 *             properties:
 *               assignedToId:
 *                 type: integer
 *     responses:
 *       200:
 *         description: Bug assigned successfully
 */
// ── ASSIGN BUG ────────────────────────────────────────────────────────────────
router.patch('/:id/assign', authenticate, authorizeRole('TESTER'), async (req, res) => {
  try {
    const bugId        = parseInt(req.params.id)
    const assignedToId = parseInt(req.body.assignedToId)
    if (!assignedToId) return res.status(400).json({ message: 'assignedToId is required' })

    const bug = await prisma.bug.findUnique({ where: { id: bugId } })
    if (!bug) return res.status(404).json({ message: 'Bug not found' })
    if (!await requireMember(bug.projectId, req.user.userId, res)) return

    const developer = await prisma.user.findUnique({ where: { id: assignedToId } })
    if (!developer || developer.role !== 'DEVELOPER')
      return res.status(400).json({ message: 'Assigned user must be a valid developer' })

    const devMember = await prisma.projectMember.findUnique({
      where: { projectId_userId: { projectId: bug.projectId, userId: assignedToId } }
    })
    if (!devMember) return res.status(400).json({ message: 'Developer is not a member of this project' })

    const updatedBug = await prisma.bug.update({ where: { id: bugId }, data: { assignedToId } })

    // ✅ Notify the assigned developer
    await notifyBugAssigned({ bug: updatedBug, assignedToId, actorId: req.user.userId })

    res.json(updatedBug)
  } catch (error) {
    console.error('ASSIGN BUG ERROR:', error)
    res.status(500).json({ message: 'Failed to assign bug' })
  }
})

/**
 * @swagger
 * /bugs/{id}/status:
 *   patch:
 *     summary: Update bug status
 *     tags: [Bugs]
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
 *             properties:
 *               status:
 *                 type: string
 *                 example: IN_PROGRESS
 *               fixNotes:
 *                 type: string
 *               commitHash:
 *                 type: string
 *               branchName:
 *                 type: string
 *     responses:
 *       200:
 *         description: Bug status updated
 */
// ── UPDATE STATUS ─────────────────────────────────────────────────────────────
router.patch('/:id/status', authenticate, async (req, res) => {
  try {
    const bugId = parseInt(req.params.id)
    const { status, fixNotes, commitHash, branchName } = req.body

    const bug = await prisma.bug.findUnique({ where: { id: bugId } })
    if (!bug) return res.status(404).json({ message: 'Bug not found' })
    if (!await requireMember(bug.projectId, req.user.userId, res)) return

    const validTransitions = {
      NEW:         ['OPEN', 'WONT_FIX', 'DUPLICATE'],
      OPEN:        ['IN_PROGRESS'],
      IN_PROGRESS: ['FIXED'],
      FIXED:       ['VERIFIED', 'REOPENED'],
      VERIFIED:    ['CLOSED'],
      REOPENED:    ['IN_PROGRESS'],
      WONT_FIX:    [],
      DUPLICATE:   [],
      CLOSED:      []
    }

    if (!validTransitions[bug.status]?.includes(status))
      return res.status(400).json({ message: `Invalid transition from ${bug.status} to ${status}` })

    if (req.user.role === 'DEVELOPER' && bug.assignedToId !== req.user.userId)
      return res.status(403).json({ message: 'Not assigned to you' })

    if (status === 'FIXED' && !fixNotes)
      return res.status(400).json({ message: 'Fix notes are required when marking as FIXED' })

    const updateData = {
      status,
      fixNotes:   fixNotes   || bug.fixNotes,
      commitHash: commitHash || bug.commitHash,
      branchName: branchName || bug.branchName
    }
    if (status === 'FIXED' || status === 'CLOSED') updateData.resolvedAt = new Date()

    const updatedBug = await prisma.bug.update({ where: { id: bugId }, data: updateData })

    // ✅ Fire the correct notification(s) for this transition
    await notifyBugTransition({
      bug:       { ...bug, id: bugId },
      newStatus: status,
      actorId:   req.user.userId,
      fixNotes
    })

    res.json(updatedBug)
  } catch (error) {
    console.error('STATUS UPDATE ERROR:', error)
    res.status(500).json({ message: 'Failed to update bug status' })
  }
})

/**
 * @swagger
 * /bugs/my/assigned:
 *   get:
 *     summary: Get bugs assigned to the logged-in developer
 *     tags: [Bugs]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of assigned bugs
 */
// ── MY ASSIGNED BUGS (Developer) ──────────────────────────────────────────────
router.get('/my/assigned', authenticate, authorizeRole('DEVELOPER'), async (req, res) => {
  try {
    const { projectId, status, priority } = req.query
    const where = { assignedToId: req.user.userId }
    if (projectId) where.projectId = parseInt(projectId)
    if (status)    where.status    = status
    if (priority)  where.priority  = priority

    const bugs = await prisma.bug.findMany({
      where,
      include: { createdBy: { select: { id: true, name: true } } },
      orderBy: { createdAt: 'desc' }
    })

    res.json(bugs.map(bug => ({
      ...bug,
      ageInDays: Math.floor((Date.now() - new Date(bug.createdAt).getTime()) / 86400000)
    })))
  } catch (error) {
    console.error('MY BUGS ERROR:', error)
    res.status(500).json({ message: 'Failed to fetch assigned bugs' })
  }
})

/**
 * @swagger
 * /bugs/my/reported:
 *   get:
 *     summary: Get bugs reported by the current user
 *     tags: [Bugs]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of reported bugs
 */
// ── REPORTED BUGS ─────────────────────────────────────────────────────────────
router.get('/my/reported', authenticate, async (req, res) => {
  try {
    const { projectId } = req.query
    const where = { createdById: req.user.userId }
    if (projectId) where.projectId = parseInt(projectId)

    const bugs = await prisma.bug.findMany({
      where,
      include: { assignedTo: { select: { id: true, name: true } } },
      orderBy: { createdAt: 'desc' }
    })
    res.json(bugs)
  } catch (error) {
    console.error('REPORTED BUGS ERROR:', error)
    res.status(500).json({ message: 'Failed to fetch reported bugs' })
  }
})

/**
 * @swagger
 * /bugs/{id}/comments:
 *   post:
 *     summary: Add a comment to a bug
 *     tags: [Bugs]
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
 *             properties:
 *               content:
 *                 type: string
 *     responses:
 *       201:
 *         description: Comment added
 */
// ── COMMENTS ──────────────────────────────────────────────────────────────────
router.post('/:id/comments', authenticate, async (req, res) => {
  try {
    const bugId   = parseInt(req.params.id)
    const { content } = req.body
    if (!content) return res.status(400).json({ message: 'Comment cannot be empty' })

    const bug = await prisma.bug.findUnique({ where: { id: bugId } })
    if (!bug) return res.status(404).json({ message: 'Bug not found' })
    if (!await requireMember(bug.projectId, req.user.userId, res)) return

    const comment = await prisma.bugComment.create({
      data: { content, bugId, userId: req.user.userId }
    })

    // ✅ Notify the other party about the comment
    await notifyBugComment({
      bug,
      actorId:   req.user.userId,
      actorRole: req.user.role
    })

    res.status(201).json(comment)
  } catch (error) {
    console.error('ADD COMMENT ERROR:', error)
    res.status(500).json({ message: 'Failed to add comment' })
  }
})

/**
 * @swagger
 * /bugs/{id}/comments:
 *   get:
 *     summary: Get comments for a bug
 *     tags: [Bugs]
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
 *         description: List of comments
 */
router.get('/:id/comments', authenticate, async (req, res) => {
  try {
    const bugId = parseInt(req.params.id)
    const bug   = await prisma.bug.findUnique({ where: { id: bugId } })
    if (!bug) return res.status(404).json({ message: 'Bug not found' })
    if (!await requireMember(bug.projectId, req.user.userId, res)) return

    const comments = await prisma.bugComment.findMany({
      where:   { bugId },
      include: { user: { select: { id: true, name: true, email: true, role: true } } },
      orderBy: { createdAt: 'asc' }
    })
    res.json(comments)
  } catch (error) {
    console.error('GET COMMENTS ERROR:', error)
    res.status(500).json({ message: 'Failed to fetch comments' })
  }
})

/**
 * @swagger
 * /bugs/comments/{commentId}:
 *   patch:
 *     summary: Edit a bug comment
 *     tags: [Bugs]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: commentId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Comment updated
 */
router.patch('/comments/:commentId', authenticate, async (req, res) => {
  try {
    const commentId = parseInt(req.params.commentId)
    const { content } = req.body
    const comment = await prisma.bugComment.findUnique({ where: { id: commentId } })
    if (!comment) return res.status(404).json({ message: 'Comment not found' })
    if (comment.userId !== req.user.userId) return res.status(403).json({ message: 'Not your comment' })
    if ((Date.now() - new Date(comment.createdAt).getTime()) / 60000 > 5)
      return res.status(400).json({ message: 'Edit window expired (5 minutes)' })

    const updated = await prisma.bugComment.update({ where: { id: commentId }, data: { content } })
    res.json(updated)
  } catch (error) {
    console.error('EDIT COMMENT ERROR:', error)
    res.status(500).json({ message: 'Failed to update comment' })
  }
})

/**
 * @swagger
 * /bugs/comments/{commentId}:
 *   delete:
 *     summary: Delete a bug comment
 *     tags: [Bugs]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: commentId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Comment deleted
 */
router.delete('/comments/:commentId', authenticate, async (req, res) => {
  try {
    const commentId = parseInt(req.params.commentId)
    const comment   = await prisma.bugComment.findUnique({ where: { id: commentId } })
    if (!comment) return res.status(404).json({ message: 'Comment not found' })
    if (comment.userId !== req.user.userId) return res.status(403).json({ message: 'Not your comment' })
    if ((Date.now() - new Date(comment.createdAt).getTime()) / 60000 > 5)
      return res.status(400).json({ message: 'Delete window expired (5 minutes)' })

    await prisma.bugComment.delete({ where: { id: commentId } })
    res.json({ message: 'Comment deleted' })
  } catch (error) {
    console.error('DELETE COMMENT ERROR:', error)
    res.status(500).json({ message: 'Failed to delete comment' })
  }
})

module.exports = router