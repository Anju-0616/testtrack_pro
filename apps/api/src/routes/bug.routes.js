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

module.exports = router
