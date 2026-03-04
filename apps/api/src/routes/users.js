/**
 * @swagger
 * tags:
 *   name: Users
 *   description: User management APIs
 */

const express = require("express")
const prisma = require("../prisma")
const { authenticate } = require("../middleware/auth")

const router = express.Router()

/**
 * @swagger
 * /users/testers:
 *   get:
 *     summary: Get all testers
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of testers
 */
router.get("/testers", authenticate, async (req, res) => {
  try {
    const testers = await prisma.user.findMany({
      where: { role: "TESTER" },
      select: {
        id: true,
        email: true
      }
    })

    res.json(testers)

  } catch (error) {
    console.error(error)
    res.status(500).json({ message: "Failed to fetch testers" })
  }
})

module.exports = router