const express = require('express')
const prisma = require('../prisma')
const { authenticate, authorizeRole } = require('../middleware/auth')

const router = express.Router()

const VALID_STATUSES = ['PLANNED', 'IN_PROGRESS', 'COMPLETED', 'ABORTED']

async function requireMember(projectId, userId, res) {
  const member = await prisma.projectMember.findUnique({
    where: { projectId_userId: { projectId, userId } }
  })
  if (!member) { res.status(403).json({ message: 'Not a member of this project' }); return false }
  return true
}

// ── CREATE TEST RUN ───────────────────────────────────────────────────────────
router.post('/', authenticate, authorizeRole('TESTER'), async (req, res) => {
  try {
    const { projectId, name, description, startDate, endDate, milestoneId } = req.body
    if (!projectId) return res.status(400).json({ message: 'projectId is required' })
    if (!name?.trim()) return res.status(400).json({ message: 'Test run name is required' })
    if (!await requireMember(parseInt(projectId), req.user.userId, res)) return

    const run = await prisma.testRun.create({
      data: {
        projectId:   parseInt(projectId),
        name:        name.trim(),
        description: description?.trim() || null,
        status:      'PLANNED',
        startDate:   startDate   ? new Date(startDate)   : null,
        endDate:     endDate     ? new Date(endDate)     : null,
        milestoneId: milestoneId ? parseInt(milestoneId) : null,
        createdBy:   req.user.userId
      },
      include: {
        creator:   { select: { id: true, name: true } },
        milestone: true
      }
    })
    res.status(201).json(run)
  } catch (err) {
    console.error('CREATE RUN ERROR:', err)
    res.status(500).json({ message: 'Failed to create test run' })
  }
})

// ── LIST TEST RUNS (scoped to project) ───────────────────────────────────────
router.get('/', authenticate, async (req, res) => {
  try {
    const { projectId, status } = req.query
    if (!projectId) return res.status(400).json({ message: 'projectId is required' })
    if (!await requireMember(parseInt(projectId), req.user.userId, res)) return

    const where = { projectId: parseInt(projectId) }
    if (status && VALID_STATUSES.includes(status)) where.status = status

    const runs = await prisma.testRun.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        creator:   { select: { id: true, name: true } },
        milestone: true,
        _count:    { select: { executions: true } }
      }
    })

    const enriched = await Promise.all(runs.map(async run => {
      const stats = await prisma.testExecution.groupBy({
        by: ['status'], where: { testRunId: run.id }, _count: true
      })
      const statusMap = {}
      stats.forEach(s => { statusMap[s.status] = s._count })
      return { ...run, statusBreakdown: statusMap }
    }))

    res.json(enriched)
  } catch (err) {
    console.error('LIST RUNS ERROR:', err)
    res.status(500).json({ message: 'Failed to fetch test runs' })
  }
})

// ── GET SINGLE TEST RUN ───────────────────────────────────────────────────────
router.get('/:id', authenticate, async (req, res) => {
  try {
    const id = parseInt(req.params.id)
    if (isNaN(id)) return res.status(400).json({ message: 'Invalid ID' })

    const run = await prisma.testRun.findUnique({
      where: { id },
      include: {
        creator:   { select: { id: true, name: true } },
        milestone: true,
        executions: {
          include: {
            testCase: { select: { id: true, title: true, priority: true, module: true } },
            tester:   { select: { id: true, name: true } }
          },
          orderBy: { startedAt: 'desc' }
        }
      }
    })

    if (!run) return res.status(404).json({ message: 'Test run not found' })
    if (!await requireMember(run.projectId, req.user.userId, res)) return
    res.json(run)
  } catch (err) {
    console.error('GET RUN ERROR:', err)
    res.status(500).json({ message: 'Internal server error' })
  }
})

// ── UPDATE TEST RUN ───────────────────────────────────────────────────────────
router.put('/:id', authenticate, authorizeRole('TESTER'), async (req, res) => {
  try {
    const id = parseInt(req.params.id)
    if (isNaN(id)) return res.status(400).json({ message: 'Invalid ID' })

    const existing = await prisma.testRun.findUnique({ where: { id } })
    if (!existing) return res.status(404).json({ message: 'Test run not found' })
    if (!await requireMember(existing.projectId, req.user.userId, res)) return

    const { name, description, status, startDate, endDate, milestoneId } = req.body
    const data = {}

    if (name        !== undefined) data.name        = name.trim()
    if (description !== undefined) data.description = description?.trim() || null
    if (status      !== undefined) {
      if (!VALID_STATUSES.includes(status)) return res.status(400).json({ message: 'Invalid status' })
      data.status = status
    }
    if (startDate   !== undefined) data.startDate   = startDate ? new Date(startDate) : null
    if (endDate     !== undefined) data.endDate     = endDate   ? new Date(endDate)   : null
    if (milestoneId !== undefined) data.milestoneId = milestoneId ? parseInt(milestoneId) : null

    const updated = await prisma.testRun.update({ where: { id }, data })
    res.json(updated)
  } catch (err) {
    console.error('UPDATE RUN ERROR:', err)
    res.status(500).json({ message: 'Failed to update test run' })
  }
})

// ── DELETE TEST RUN ───────────────────────────────────────────────────────────
router.delete('/:id', authenticate, authorizeRole('TESTER'), async (req, res) => {
  try {
    const id = parseInt(req.params.id)
    const existing = await prisma.testRun.findUnique({ where: { id } })
    if (!existing) return res.status(404).json({ message: 'Test run not found' })
    if (!await requireMember(existing.projectId, req.user.userId, res)) return

    await prisma.testRun.delete({ where: { id } })
    res.json({ message: 'Test run deleted' })
  } catch (err) {
    console.error('DELETE RUN ERROR:', err)
    res.status(500).json({ message: 'Failed to delete test run' })
  }
})

module.exports = router