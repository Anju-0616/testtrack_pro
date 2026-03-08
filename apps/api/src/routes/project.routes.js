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