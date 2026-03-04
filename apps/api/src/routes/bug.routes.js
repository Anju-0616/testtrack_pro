/**
 * @swagger
 * tags:
 *   name: Bugs
 *   description: Bug management APIs
 */

const express = require('express')
const prisma = require('../prisma')
const { authenticate, authorizeRole } = require('../middleware/auth')
const { createBugSchema } = require('../validators/bug.schema')
const { createNotification } = require('../services/notification.service')

const router = express.Router()

/**
 * @swagger
 * /bugs:
 *   post:
 *     summary: Create a new bug
 *     tags: [Bugs]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               title:
 *                 type: string
 *               description:
 *                 type: string
 *               severity:
 *                 type: string
 *               priority:
 *                 type: string
 *     responses:
 *       201:
 *         description: Bug created successfully
 */

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

/**
 * @swagger
 * /bugs/{id}/assign:
 *   patch:
 *     summary: Assign bug to a developer (Tester only)
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
 *             required: [assignedToId]
 *             properties:
 *               assignedToId:
 *                 type: integer
 *     responses:
 *       200:
 *         description: Bug assigned successfully
 *       400:
 *         description: Invalid request
 *       404:
 *         description: Bug not found
 */

/*
  ASSIGN BUG
  PATCH /bugs/:id/assign
*/
router.patch(
  "/:id/assign",
  authenticate,
  authorizeRole("TESTER"),
  async (req, res) => {
    try {
      const bugId = parseInt(req.params.id)
      const assignedToId = parseInt(req.body.assignedToId)

      if (!assignedToId) {
        return res.status(400).json({ message: "assignedToId is required" })
      }

      // Check bug exists
      const bug = await prisma.bug.findUnique({
        where: { id: bugId },
      })

      if (!bug) {
        return res.status(404).json({ message: "Bug not found" })
      }

      // Check developer exists and role is DEVELOPER
      const developer = await prisma.user.findUnique({
        where: { id: assignedToId },
      })

      if (!developer || developer.role !== "DEVELOPER") {
        return res.status(400).json({
          message: "Assigned user must be a valid developer",
        })
      }

      // Update bug
      const updatedBug = await prisma.bug.update({
        where: { id: bugId },
        data: { assignedToId },
      })

      // 🔔 Create notification
      await createNotification({
        userId: assignedToId,
        type: "BUG_ASSIGNED",
        title: "New Bug Assigned",
        message: `Bug #${updatedBug.id} has been assigned to you`,
        relatedId: updatedBug.id.toString(),
        relatedType: "BUG",
      })

      res.json(updatedBug)

    } catch (error) {
      console.error(error)
      res.status(500).json({ message: "Failed to assign bug" })
    }
  }
)

/**
 * @swagger
 * /bugs/{id}/status:
 *   patch:
 *     summary: Update bug status (Workflow controlled)
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
 *             required: [status]
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [NEW, OPEN, IN_PROGRESS, FIXED, VERIFIED, REOPENED, CLOSED, WONT_FIX, DUPLICATE]
 *               fixNotes:
 *                 type: string
 *               commitHash:
 *                 type: string
 *               branchName:
 *                 type: string
 *     responses:
 *       200:
 *         description: Bug status updated
 *       400:
 *         description: Invalid status transition
 *       403:
 *         description: Unauthorized action
 *       404:
 *         description: Bug not found
 */

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

      // 🔔 Notify tester when bug marked FIXED
if (status === "FIXED") {
  await createNotification({
    userId: bug.createdById, // original tester
    type: "BUG_FIXED",
    title: "Bug Ready for Re-test",
    message: `Bug ${updatedBug.bugId} has been marked as FIXED`,
    relatedId: updatedBug.id.toString(),
    relatedType: "BUG",
  })
}

      res.json(updatedBug)

    } catch (error) {
      console.error(error)
      res.status(500).json({ message: "Failed to update bug status" })
    }
  }
)

/**
 * @swagger
 * /bugs/my:
 *   get:
 *     summary: Get bugs assigned to current developer
 *     tags: [Bugs]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *       - in: query
 *         name: priority
 *         schema:
 *           type: string
 *       - in: query
 *         name: sort
 *         schema:
 *           type: string
 *           enum: [priority, createdAt]
 *     responses:
 *       200:
 *         description: List of assigned bugs
 */

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

/**
 * @swagger
 * /bugs/{id}/comments:
 *   post:
 *     summary: Add comment to a bug
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
 *             required: [content]
 *             properties:
 *               content:
 *                 type: string
 *     responses:
 *       201:
 *         description: Comment added successfully
 */

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

    // 🔔 Notify other party about new comment
const bug = await prisma.bug.findUnique({
  where: { id: bugId }
})

let notifyUserId = null

// If commenter is developer → notify tester
if (req.user.role === "DEVELOPER") {
  notifyUserId = bug.createdById
}

// If commenter is tester → notify assigned developer
if (req.user.role === "TESTER" && bug.assignedToId) {
  notifyUserId = bug.assignedToId
}

if (notifyUserId && notifyUserId !== req.user.userId) {
  await createNotification({
    userId: notifyUserId,
    type: "BUG_COMMENT",
    title: "New Comment on Bug",
    message: `New comment added on ${bug.bugId}`,
    relatedId: bug.id.toString(),
    relatedType: "BUG",
  })
}

    res.status(201).json(comment)

  } catch (error) {
    console.error(error)
    res.status(500).json({ message: "Failed to add comment" })
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

/**
 * @swagger
 * /bugs/comments/{commentId}:
 *   patch:
 *     summary: Edit a comment (within 5 minutes)
 *     tags: [Bugs]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: commentId
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
 *       200:
 *         description: Comment updated
 *       403:
 *         description: Not allowed
 */

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

/**
 * @swagger
 * /bugs/comments/{commentId}:
 *   delete:
 *     summary: Delete a comment (within 5 minutes)
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
 *       403:
 *         description: Not allowed
 */

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

router.get('/reported', authenticate, async (req, res) => {
  try {
    const bugs = await prisma.bug.findMany({
      where: {
        createdById: req.user.userId
      },
      include: {
        assignedTo: {
          select: {
            id: true,
            email: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    })

    res.json(bugs)

  } catch (error) {
    console.error(error)
    res.status(500).json({ message: "Failed to fetch bugs" })
  }
})

module.exports = router
