/**
 * @swagger
 * tags:
 *   name: Milestones
 *   description: Milestone management APIs
 */

const express = require('express')
const prisma   = require('../prisma')
const { authenticate, authorizeRole } = require('../middleware/auth')

const router = express.Router()


/**
 * @swagger
 * /milestones:
 *   post:
 *     summary: Create a milestone (Tester only)
 *     tags: [Milestones]
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
 *               - targetDate
 *             properties:
 *               name:
 *                 type: string
 *                 example: Sprint 1 Release
 *               description:
 *                 type: string
 *                 example: Initial testing phase
 *               targetDate:
 *                 type: string
 *                 format: date
 *                 example: 2026-04-01
 *     responses:
 *       201:
 *         description: Milestone created successfully
 *       400:
 *         description: Name and targetDate required
 */
//Create Milestone
router.post('/', authenticate, authorizeRole('TESTER'), async (req, res) => {
  try {
    const { name, description, targetDate } = req.body
    if (!name?.trim() || !targetDate)
      return res.status(400).json({ message: 'Name and targetDate are required' })

    const milestone = await prisma.milestone.create({
      data: {
        name:        name.trim(),
        description: description?.trim() || null,
        targetDate:  new Date(targetDate),
        createdBy:   req.user.userId
      }
    })
    res.status(201).json(milestone)
  } catch (err) {
    console.error('CREATE MILESTONE ERROR:', err)
    res.status(500).json({ message: 'Failed to create milestone' })
  }
})


/**
 * @swagger
 * /milestones:
 *   get:
 *     summary: Get all milestones
 *     tags: [Milestones]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of milestones
 */
//List Milestones
router.get('/', authenticate, async (req, res) => {
  try {
    const milestones = await prisma.milestone.findMany({
      orderBy: { targetDate: 'asc' },
      include: {
        creator:  { select: { id: true, name: true } },
        _count:   { select: { testRuns: true } }
      }
    })
    res.json(milestones)
  } catch (err) {
    console.error('LIST MILESTONES ERROR:', err)
    res.status(500).json({ message: 'Failed to fetch milestones' })
  }
})


/**
 * @swagger
 * /milestones/{id}:
 *   get:
 *     summary: Get milestone details
 *     tags: [Milestones]
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
 *         description: Milestone details
 *       404:
 *         description: Milestone not found
 */
//Get singleMilestone 
router.get('/:id', authenticate, async (req, res) => {
  try {
    const id = parseInt(req.params.id)
    const milestone = await prisma.milestone.findUnique({
      where:   { id },
      include: {
        testRuns: {
          include: { _count: { select: { executions: true } } }
        }
      }
    })
    if (!milestone) return res.status(404).json({ message: 'Milestone not found' })
    res.json(milestone)
  } catch (err) {
    res.status(500).json({ message: 'Internal server error' })
  }
})


/**
 * @swagger
 * /milestones/{id}:
 *   put:
 *     summary: Update milestone
 *     tags: [Milestones]
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
 *               targetDate:
 *                 type: string
 *                 format: date
 *               status:
 *                 type: string
 *                 enum: [PLANNED, IN_PROGRESS, COMPLETED]
 *     responses:
 *       200:
 *         description: Milestone updated successfully
 */
//update 
router.put('/:id', authenticate, async (req, res) => {
  try {
    const id = parseInt(req.params.id)
    const { name, description, targetDate, status } = req.body
    const data = {}
    if (name       !== undefined) data.name        = name.trim()
    if (description !== undefined) data.description = description?.trim() || null
    if (targetDate  !== undefined) data.targetDate  = new Date(targetDate)
    if (status      !== undefined) data.status      = status

    const updated = await prisma.milestone.update({ where: { id }, data })
    res.json(updated)
  } catch (err) {
    res.status(500).json({ message: 'Failed to update milestone' })
  }
})

module.exports = router