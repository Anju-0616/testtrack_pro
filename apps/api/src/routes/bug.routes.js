const express = require('express')
const prisma = require('../prisma')
const { authenticate, authorizeRole } = require('../middleware/auth')
const { createBugSchema } = require('../validators/bug.schema')

const router = express.Router()

/*
  CREATE BUG
  POST /bugs
*/
router.post(
  '/',
  authenticate,
  authorizeRole('TESTER'),
  async (req, res) => {
    try {
      // Validate request body
      const parsed = createBugSchema.parse(req.body)

      // Generate Bug ID
      const year = new Date().getFullYear()
      const count = await prisma.bug.count()
      const bugId = `BUG-${year}-${String(count + 1).padStart(5, '0')}`

      // Create bug using validated data
      const bug = await prisma.bug.create({
        data: {
          bugId,
          ...parsed,
          createdById: req.user.userId
        }
      })

      res.status(201).json(bug)

    } catch (error) {

      if (error.name === "ZodError") {
        return res.status(400).json({
          message: "Validation failed",
          errors: error.errors
        })
      }

      console.error(error)
      res.status(500).json({ message: 'Failed to create bug' })
    }
  }
)

/*
  UPDATE BUG STATUS
  PATCH /bugs/:id/status
*/
router.patch(
  '/:id/status',
  authenticate,
  async (req, res) => {
    try {
      const bugId = parseInt(req.params.id)
      const { status, fixNotes, commitHash, branchName } = req.body

      const bug = await prisma.bug.findUnique({
        where: { id: bugId }
      })

      if (!bug) {
        return res.status(404).json({ message: "Bug not found" })
      }

      // 🔁 VALID TRANSITIONS
      const validTransitions = {
        NEW: ['OPEN', 'WONT_FIX', 'DUPLICATE'],
        OPEN: ['IN_PROGRESS'],
        IN_PROGRESS: ['FIXED'],
        FIXED: ['VERIFIED', 'REOPENED'],
        VERIFIED: ['CLOSED'],
        REOPENED: ['IN_PROGRESS'],
        WONT_FIX: [],
        DUPLICATE: [],
        CLOSED: []
      }

      if (!validTransitions[bug.status].includes(status)) {
        return res.status(400).json({
          message: `Invalid transition from ${bug.status} to ${status}`
        })
      }

      // 🔐 ROLE CHECK
      if (req.user.role === "DEVELOPER") {
        if (bug.assignedToId !== req.user.userId) {
          return res.status(403).json({ message: "Not assigned to you" })
        }
      }

      // 🛠 Require fixNotes when marking FIXED
      if (status === "FIXED" && !fixNotes) {
        return res.status(400).json({
          message: "Fix notes are required when marking as FIXED"
        })
      }

      const updateData = {
        status,
        fixNotes: fixNotes || bug.fixNotes,
        commitHash: commitHash || bug.commitHash,
        branchName: branchName || bug.branchName
      }

      // ⏱ Set resolvedAt when closed or fixed
      if (status === "FIXED" || status === "CLOSED") {
        updateData.resolvedAt = new Date()
      }

      const updatedBug = await prisma.bug.update({
        where: { id: bugId },
        data: updateData
      })

      res.json(updatedBug)

    } catch (error) {
      console.error(error)
      res.status(500).json({ message: "Failed to update bug status" })
    }
  }
)

/*
  GET MY ASSIGNED BUGS (Developer Dashboard)
  GET /bugs/my
*/
router.get(
  '/my',
  authenticate,
  authorizeRole('DEVELOPER'),
  async (req, res) => {
    try {
      const { status, priority, sort } = req.query

      const whereClause = {
        assignedToId: req.user.userId
      }

      if (status) {
        whereClause.status = status
      }

      if (priority) {
        whereClause.priority = priority
      }

      const orderBy = {}

      if (sort === 'priority') {
        orderBy.priority = 'asc'
      } else if (sort === 'createdAt') {
        orderBy.createdAt = 'desc'
      }

      const bugs = await prisma.bug.findMany({
        where: whereClause,
        orderBy: Object.keys(orderBy).length ? orderBy : undefined
      })

      // Calculate age in days
      const bugsWithAge = bugs.map(bug => {
        const age = Math.floor(
          (new Date() - new Date(bug.createdAt)) /
          (1000 * 60 * 60 * 24)
        )

        return {
          ...bug,
          ageInDays: age
        }
      })

      res.json(bugsWithAge)

    } catch (error) {
      console.error(error)
      res.status(500).json({ message: 'Failed to fetch assigned bugs' })
    }
  }
)

/*
  POST /bugs/:id/comments
*/
router.post('/:id/comments', authenticate, async (req, res) => {
  try {
    const bugId = parseInt(req.params.id)
    const { content } = req.body

    if (!content) {
      return res.status(400).json({ message: "Comment cannot be empty" })
    }

    const comment = await prisma.bugComment.create({
      data: {
        content,
        bugId,
        userId: req.user.userId
      }
    })

    res.status(201).json(comment)

  } catch (error) {
    console.error(error)
    res.status(500).json({ message: "Failed to add comment" })
  }
})

/*
  GET /bugs/:id/comments
*/
router.get('/:id/comments', authenticate, async (req, res) => {
  try {
    const bugId = parseInt(req.params.id)

    const comments = await prisma.bugComment.findMany({
      where: { bugId },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            role: true
          }
        }
      },
      orderBy: { createdAt: 'asc' }
    })

    res.json(comments)

  } catch (error) {
    console.error(error)
    res.status(500).json({ message: "Failed to fetch comments" })
  }
})

/*
  PATCH /bugs/comments/:commentId
*/
router.patch('/comments/:commentId', authenticate, async (req, res) => {
  try {
    const commentId = parseInt(req.params.commentId)
    const { content } = req.body

    const comment = await prisma.bugComment.findUnique({
      where: { id: commentId }
    })

    if (!comment) {
      return res.status(404).json({ message: "Comment not found" })
    }

    if (comment.userId !== req.user.userId) {
      return res.status(403).json({ message: "Not your comment" })
    }

    const timeDiff = (new Date() - new Date(comment.createdAt)) / (1000 * 60)

    if (timeDiff > 5) {
      return res.status(400).json({
        message: "Edit window expired (5 minutes)"
      })
    }

    const updated = await prisma.bugComment.update({
      where: { id: commentId },
      data: { content }
    })

    res.json(updated)

  } catch (error) {
    console.error(error)
    res.status(500).json({ message: "Failed to update comment" })
  }
})

/*
  DELETE /bugs/comments/:commentId
*/
router.delete('/comments/:commentId', authenticate, async (req, res) => {
  try {
    const commentId = parseInt(req.params.commentId)

    const comment = await prisma.bugComment.findUnique({
      where: { id: commentId }
    })

    if (!comment) {
      return res.status(404).json({ message: "Comment not found" })
    }

    if (comment.userId !== req.user.userId) {
      return res.status(403).json({ message: "Not your comment" })
    }

    const timeDiff = (new Date() - new Date(comment.createdAt)) / (1000 * 60)

    if (timeDiff > 5) {
      return res.status(400).json({
        message: "Delete window expired (5 minutes)"
      })
    }

    await prisma.bugComment.delete({
      where: { id: commentId }
    })

    res.json({ message: "Comment deleted" })

  } catch (error) {
    console.error(error)
    res.status(500).json({ message: "Failed to delete comment" })
  }
})

module.exports = router
