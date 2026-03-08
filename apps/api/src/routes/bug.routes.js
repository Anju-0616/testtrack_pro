const express = require('express')
const prisma = require('../prisma')
const { authenticate, authorizeRole } = require('../middleware/auth')
const { createBugSchema } = require('../validators/bug.schema')
const { createNotification } = require('../services/notification.service')

const router = express.Router()

async function requireMember(projectId, userId, res) {
  const member = await prisma.projectMember.findUnique({
    where: { projectId_userId: { projectId, userId } }
  })
  if (!member) { res.status(403).json({ message: 'Not a member of this project' }); return false }
  return true
}

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

    res.status(201).json(bug)
  } catch (error) {
    if (error.name === 'ZodError') return res.status(400).json({ message: 'Validation failed', errors: error.errors })
    console.error('CREATE BUG ERROR:', error)
    res.status(500).json({ message: 'Failed to create bug' })
  }
})

// ── GET ALL BUGS (scoped to project) ─────────────────────────────────────────
router.get('/', authenticate, async (req, res) => {
  try {
    const { projectId, status, priority, search, page = 1, limit = 20 } = req.query
    if (!projectId) return res.status(400).json({ message: 'projectId is required' })

    if (!await requireMember(parseInt(projectId), req.user.userId, res)) return

    const pageNum  = Math.max(1, parseInt(page))
    const pageSize = Math.min(100, Math.max(1, parseInt(limit)))

    const where = { projectId: parseInt(projectId) }
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
        skip:    (pageNum - 1) * pageSize,
        take:    pageSize
      })
    ])

    res.json({ data: bugs, pagination: { total, page: pageNum, limit: pageSize, totalPages: Math.ceil(total / pageSize) } })
  } catch (error) {
    console.error('GET BUGS ERROR:', error)
    res.status(500).json({ message: 'Failed to fetch bugs' })
  }
})

// ── GET SINGLE BUG ────────────────────────────────────────────────────────────
router.get('/:id', authenticate, async (req, res) => {
  try {
    const id = parseInt(req.params.id)
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

// ── ASSIGN BUG ────────────────────────────────────────────────────────────────
router.patch('/:id/assign', authenticate, authorizeRole('TESTER'), async (req, res) => {
  try {
    const bugId       = parseInt(req.params.id)
    const assignedToId = parseInt(req.body.assignedToId)
    if (!assignedToId) return res.status(400).json({ message: 'assignedToId is required' })

    const bug = await prisma.bug.findUnique({ where: { id: bugId } })
    if (!bug) return res.status(404).json({ message: 'Bug not found' })
    if (!await requireMember(bug.projectId, req.user.userId, res)) return

    const developer = await prisma.user.findUnique({ where: { id: assignedToId } })
    if (!developer || developer.role !== 'DEVELOPER')
      return res.status(400).json({ message: 'Assigned user must be a valid developer' })

    // Developer must also be a project member
    const devMember = await prisma.projectMember.findUnique({
      where: { projectId_userId: { projectId: bug.projectId, userId: assignedToId } }
    })
    if (!devMember) return res.status(400).json({ message: 'Developer is not a member of this project' })

    const updatedBug = await prisma.bug.update({ where: { id: bugId }, data: { assignedToId } })

    await createNotification({
      userId: assignedToId, type: 'BUG_ASSIGNED', title: 'New Bug Assigned',
      message: `Bug ${updatedBug.bugId} has been assigned to you`,
      relatedId: updatedBug.id.toString(), relatedType: 'BUG'
    })

    res.json(updatedBug)
  } catch (error) {
    console.error('ASSIGN BUG ERROR:', error)
    res.status(500).json({ message: 'Failed to assign bug' })
  }
})

// ── UPDATE STATUS ─────────────────────────────────────────────────────────────
router.patch('/:id/status', authenticate, async (req, res) => {
  try {
    const bugId = parseInt(req.params.id)
    const { status, fixNotes, commitHash, branchName } = req.body

    const bug = await prisma.bug.findUnique({ where: { id: bugId } })
    if (!bug) return res.status(404).json({ message: 'Bug not found' })
    if (!await requireMember(bug.projectId, req.user.userId, res)) return

    /** @type {Record<string, string[]>} */
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

    if (status === 'FIXED') {
      await createNotification({
        userId: bug.createdById, type: 'BUG_FIXED', title: 'Bug Ready for Re-test',
        message: `Bug ${updatedBug.bugId} has been marked as FIXED`,
        relatedId: updatedBug.id.toString(), relatedType: 'BUG'
      })
    }

    res.json(updatedBug)
  } catch (error) {
    console.error('STATUS UPDATE ERROR:', error)
    res.status(500).json({ message: 'Failed to update bug status' })
  }
})

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

// ── COMMENTS ──────────────────────────────────────────────────────────────────
router.post('/:id/comments', authenticate, async (req, res) => {
  try {
    const bugId = parseInt(req.params.id)
    const { content } = req.body
    if (!content) return res.status(400).json({ message: 'Comment cannot be empty' })

    const bug = await prisma.bug.findUnique({ where: { id: bugId } })
    if (!bug) return res.status(404).json({ message: 'Bug not found' })
    if (!await requireMember(bug.projectId, req.user.userId, res)) return

    const comment = await prisma.bugComment.create({
      data: { content, bugId, userId: req.user.userId }
    })

    const notifyUserId = req.user.role === 'DEVELOPER' ? bug.createdById
      : bug.assignedToId ?? null

    if (notifyUserId && notifyUserId !== req.user.userId) {
      await createNotification({
        userId: notifyUserId, type: 'BUG_COMMENT', title: 'New Comment on Bug',
        message: `New comment added on ${bug.bugId}`,
        relatedId: bug.id.toString(), relatedType: 'BUG'
      })
    }

    res.status(201).json(comment)
  } catch (error) {
    console.error('ADD COMMENT ERROR:', error)
    res.status(500).json({ message: 'Failed to add comment' })
  }
})

router.get('/:id/comments', authenticate, async (req, res) => {
  try {
    const bugId = parseInt(req.params.id)
    const bug = await prisma.bug.findUnique({ where: { id: bugId } })
    if (!bug) return res.status(404).json({ message: 'Bug not found' })
    if (!await requireMember(bug.projectId, req.user.userId, res)) return

    const comments = await prisma.bugComment.findMany({
      where: { bugId },
      include: { user: { select: { id: true, name: true, email: true, role: true } } },
      orderBy: { createdAt: 'asc' }
    })
    res.json(comments)
  } catch (error) {
    console.error('GET COMMENTS ERROR:', error)
    res.status(500).json({ message: 'Failed to fetch comments' })
  }
})

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

router.delete('/comments/:commentId', authenticate, async (req, res) => {
  try {
    const commentId = parseInt(req.params.commentId)
    const comment = await prisma.bugComment.findUnique({ where: { id: commentId } })
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