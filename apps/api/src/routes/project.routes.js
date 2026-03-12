/**
 * @swagger
 * tags:
 *   name: Projects
 *   description: Project management & membership APIs
 */

const express = require('express')
const prisma = require('../prisma')
const { authenticate } = require('../middleware/auth')

const router = express.Router()


// ── Helper: check membership ──────────────────────────────────────────────────
async function requireMember(projectId, userId, res) {
  const member = await prisma.projectMember.findUnique({
    where: { projectId_userId: { projectId, userId } }
  })
  if (!member) { res.status(403).json({ message: 'Not a member of this project' }); return false }
  return member
}

/**
 * @swagger
 * /projects:
 *   post:
 *     summary: Create a new project
 *     tags: [Projects]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, key]
 *             properties:
 *               name:
 *                 type: string
 *                 example: QA Automation
 *               description:
 *                 type: string
 *                 example: Automation testing project
 *               key:
 *                 type: string
 *                 example: QA
 *     responses:
 *       201:
 *         description: Project created successfully
 *       400:
 *         description: Validation error
 */
// ── CREATE PROJECT ────────────────────────────────────────────────────────────
router.post('/', authenticate, async (req, res) => {
  try {
    const { name, description, key } = req.body
    if (!name?.trim() || !key?.trim())
      return res.status(400).json({ message: 'Name and key are required' })

    const project = await prisma.$transaction(async tx => {
      const p = await tx.project.create({
        data: {
          name:        name.trim(),
          description: description?.trim() || null,
          key:         key.trim().toUpperCase(),
          createdBy:   req.user.userId
        }
      })
      // Auto-add creator as OWNER
      await tx.projectMember.create({
        data: { projectId: p.id, userId: req.user.userId, role: 'OWNER' }
      })
      return p
    })

    res.status(201).json(project)
  } catch (err) {
    if (err.code === 'P2002') return res.status(400).json({ message: 'Project key already exists' })
    console.error('CREATE PROJECT ERROR:', err)
    res.status(500).json({ message: 'Failed to create project' })
  }
})

/**
 * @swagger
 * /projects:
 *   get:
 *     summary: Get all projects the user belongs to
 *     tags: [Projects]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of projects
 */
// ── LIST MY PROJECTS ──────────────────────────────────────────────────────────
router.get('/', authenticate, async (req, res) => {
  try {
    const memberships = await prisma.projectMember.findMany({
      where: { userId: req.user.userId },
      include: {
        project: {
          include: {
            _count: { select: { testCases: true, bugs: true, testRuns: true } },
            members: { include: { user: { select: { id: true, name: true, email: true, role: true } } } }
          }
        }
      }
    })

    const projects = memberships.map(m => ({
      ...m.project,
      myRole: m.role
    }))

    res.json(projects)
  } catch (err) {
    console.error('LIST PROJECTS ERROR:', err)
    res.status(500).json({ message: 'Failed to fetch projects' })
  }
})

/**
 * @swagger
 * /projects/{id}:
 *   get:
 *     summary: Get project details
 *     tags: [Projects]
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
 *         description: Project details
 *       403:
 *         description: Not a project member
 *       404:
 *         description: Project not found
 */
// ── GET SINGLE PROJECT ────────────────────────────────────────────────────────
router.get('/:id', authenticate, async (req, res) => {
  try {
    const projectId = parseInt(req.params.id)
    const member = await requireMember(projectId, req.user.userId, res)
    if (!member) return

    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: {
        members: {
          include: { user: { select: { id: true, name: true, email: true, role: true } } }
        },
        _count: { select: { testCases: true, bugs: true, testRuns: true } }
      }
    })

    if (!project) return res.status(404).json({ message: 'Project not found' })
    res.json({ ...project, myRole: member.role })
  } catch (err) {
    console.error('GET PROJECT ERROR:', err)
    res.status(500).json({ message: 'Internal server error' })
  }
})

/**
 * @swagger
 * /projects/{id}:
 *   put:
 *     summary: Update project details (Owner only)
 *     tags: [Projects]
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
 *             properties:
 *               name:
 *                 type: string
 *               description:
 *                 type: string
 *     responses:
 *       200:
 *         description: Project updated
 *       403:
 *         description: Only owner can update
 */
// ── UPDATE PROJECT ────────────────────────────────────────────────────────────
router.put('/:id', authenticate, async (req, res) => {
  try {
    const projectId = parseInt(req.params.id)
    const member = await requireMember(projectId, req.user.userId, res)
    if (!member) return
    if (member.role !== 'OWNER')
      return res.status(403).json({ message: 'Only the project owner can update it' })

    const { name, description } = req.body
    const updated = await prisma.project.update({
      where: { id: projectId },
      data: {
        name:        name?.trim()        || undefined,
        description: description?.trim() || null
      }
    })
    res.json(updated)
  } catch (err) {
    console.error('UPDATE PROJECT ERROR:', err)
    res.status(500).json({ message: 'Failed to update project' })
  }
})

/**
 * @swagger
 * /projects/{id}/members:
 *   post:
 *     summary: Add a member to project (Owner only)
 *     tags: [Projects]
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
 *             required: [userId]
 *             properties:
 *               userId:
 *                 type: integer
 *               role:
 *                 type: string
 *                 enum: [OWNER, MEMBER]
 *     responses:
 *       201:
 *         description: Member added
 */
// ── ADD MEMBER ────────────────────────────────────────────────────────────────
router.post('/:id/members', authenticate, async (req, res) => {
  try {
    const projectId = parseInt(req.params.id)
    const member = await requireMember(projectId, req.user.userId, res)
    if (!member) return
    if (member.role !== 'OWNER')
      return res.status(403).json({ message: 'Only owners can add members' })

    const { userId, role = 'MEMBER' } = req.body
    if (!userId) return res.status(400).json({ message: 'userId is required' })

    const user = await prisma.user.findUnique({ where: { id: parseInt(userId) } })
    if (!user) return res.status(404).json({ message: 'User not found' })

    const newMember = await prisma.projectMember.create({
      data: { projectId, userId: parseInt(userId), role },
      include: { user: { select: { id: true, name: true, email: true, role: true } } }
    })
    res.status(201).json(newMember)
  } catch (err) {
    if (err.code === 'P2002') return res.status(400).json({ message: 'User is already a member' })
    console.error('ADD MEMBER ERROR:', err)
    res.status(500).json({ message: 'Failed to add member' })
  }
})

/**
 * @swagger
 * /projects/{id}/members/{userId}:
 *   delete:
 *     summary: Remove member from project (Owner only)
 *     tags: [Projects]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Member removed
 */
// ── REMOVE MEMBER ─────────────────────────────────────────────────────────────
router.delete('/:id/members/:userId', authenticate, async (req, res) => {
  try {
    const projectId  = parseInt(req.params.id)
    const targetId   = parseInt(req.params.userId)
    const member = await requireMember(projectId, req.user.userId, res)
    if (!member) return
    if (member.role !== 'OWNER')
      return res.status(403).json({ message: 'Only owners can remove members' })

    await prisma.projectMember.delete({
      where: { projectId_userId: { projectId, userId: targetId } }
    })
    res.json({ message: 'Member removed' })
  } catch (err) {
    console.error('REMOVE MEMBER ERROR:', err)
    res.status(500).json({ message: 'Failed to remove member' })
  }
})

/**
 * @swagger
 * /projects/{id}/stats:
 *   get:
 *     summary: Get project statistics
 *     tags: [Projects]
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
 *         description: Project statistics
 */
// ── GET PROJECT STATS ─────────────────────────────────────────────────────────
router.get('/:id/stats', authenticate, async (req, res) => {
  try {
    const projectId = parseInt(req.params.id)
    const member = await requireMember(projectId, req.user.userId, res)
    if (!member) return

    const [testCaseStats, bugStats, runStats] = await Promise.all([
      prisma.testCase.groupBy({
        by: ['status'], where: { projectId, isDeleted: false }, _count: true
      }),
      prisma.bug.groupBy({
        by: ['status'], where: { projectId }, _count: true
      }),
      prisma.testRun.groupBy({
        by: ['status'], where: { projectId }, _count: true
      })
    ])

    res.json({ testCaseStats, bugStats, runStats })
  } catch (err) {
    console.error('STATS ERROR:', err)
    res.status(500).json({ message: 'Failed to fetch stats' })
  }
})

module.exports = router