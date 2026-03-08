/**
 * @swagger
 * tags:
 *   name: Notifications
 *   description: User notification APIs
 */

const express = require('express')
const prisma   = require('../prisma')
const { authenticate } = require('../middleware/auth')

const router = express.Router()

/**
 * @swagger
 * /notifications:
 *   get:
 *     summary: Get current user's notifications
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: unreadOnly
 *         schema:
 *           type: boolean
 *           example: true
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           example: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           example: 20
 *     responses:
 *       200:
 *         description: List of notifications
 */
// ─── GET MY NOTIFICATIONS ────────────────────────────────────────────────────
router.get('/', authenticate, async (req, res) => {
  try {
    const { unreadOnly, page = 1, limit = 20 } = req.query
    const pageNum  = Math.max(1, parseInt(page))
    const pageSize = Math.min(50, Math.max(1, parseInt(limit)))

    const where = { userId: req.user.userId }
    if (unreadOnly === 'true') where.isRead = false

    const [total, notifications, unreadCount] = await Promise.all([
      prisma.notification.count({ where }),
      prisma.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip:    (pageNum - 1) * pageSize,
        take:    pageSize
      }),
      prisma.notification.count({ where: { userId: req.user.userId, isRead: false } })
    ])

    res.json({
      data: notifications,
      unreadCount,
      pagination: { total, page: pageNum, limit: pageSize, totalPages: Math.ceil(total / pageSize) }
    })
  } catch (err) {
    console.error('GET NOTIFICATIONS ERROR:', err)
    res.status(500).json({ message: 'Failed to fetch notifications' })
  }
})

/**
 * @swagger
 * /notifications/{id}/read:
 *   put:
 *     summary: Mark a notification as read
 *     tags: [Notifications]
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
 *         description: Notification marked as read
 *       404:
 *         description: Notification not found
 */
// ─── MARK ONE AS READ ─────────────────────────────────────────────────────────
router.put('/:id/read', authenticate, async (req, res) => {
  try {
    const id = parseInt(req.params.id)
    if (isNaN(id)) return res.status(400).json({ message: 'Invalid ID' })

    const notif = await prisma.notification.findFirst({
      where: { id, userId: req.user.userId }
    })
    if (!notif) return res.status(404).json({ message: 'Notification not found' })

    await prisma.notification.update({ where: { id }, data: { isRead: true } })
    res.json({ message: 'Marked as read' })
  } catch (err) {
    console.error('MARK READ ERROR:', err)
    res.status(500).json({ message: 'Failed to update notification' })
  }
})

/**
 * @swagger
 * /notifications/read-all:
 *   put:
 *     summary: Mark all notifications as read
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: All notifications marked as read
 */
// ─── MARK ALL AS READ ─────────────────────────────────────────────────────────
router.put('/read-all', authenticate, async (req, res) => {
  try {
    const result = await prisma.notification.updateMany({
      where: { userId: req.user.userId, isRead: false },
      data:  { isRead: true }
    })
    res.json({ message: `${result.count} notifications marked as read` })
  } catch (err) {
    console.error('MARK ALL READ ERROR:', err)
    res.status(500).json({ message: 'Failed to update notifications' })
  }
})

// ─── DELETE A NOTIFICATION ────────────────────────────────────────────────────
router.delete('/:id', authenticate, async (req, res) => {
  try {
    const id = parseInt(req.params.id)
    const notif = await prisma.notification.findFirst({ where: { id, userId: req.user.userId } })
    if (!notif) return res.status(404).json({ message: 'Notification not found' })

    await prisma.notification.delete({ where: { id } })
    res.json({ message: 'Notification deleted' })
  } catch (err) {
    console.error('DELETE NOTIFICATION ERROR:', err)
    res.status(500).json({ message: 'Failed to delete notification' })
  }
})

module.exports = router