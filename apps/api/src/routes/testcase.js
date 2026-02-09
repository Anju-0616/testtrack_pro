const express = require('express')
const prisma = require('../prisma')
const { authenticate } = require('../middleware/auth')

const router = express.Router()

// GET /testcases/:id
router.get('/:id', authenticate, async (req, res) => {
  try {
    const testcase = await prisma.testCase.findUnique({
      where: { id: parseInt(req.params.id) }
    })

    if (!testcase) {
      return res.status(404).json({ message: 'Testcase not found' })
    }

    res.json(testcase)
  } catch (err) {
    console.error(err)
    res.status(500).json({ message: 'Internal server error' })
  }
})

// POST /testcases
router.post('/', authenticate, async (req, res) => {
  try {
    const { title, description, priority } = req.body

    if (!title) {
      return res.status(400).json({ message: 'Title required' })
    }

    const testcase = await prisma.testCase.create({
      data: {
        title,
        description,
        priority,
        createdBy: req.user.userId
      },
    })

    res.status(201).json(testcase)
  } catch (err) {
    console.error(err)
    res.status(500).json({ message: 'Internal server error' })
  }
})


// GET /testcases
router.get('/', authenticate, async (req, res) => {
  try {
    const cases = await prisma.testCase.findMany()
    res.json(cases)
  } catch (err) {
    console.error(err)
    res.status(500).json({ message: 'Internal server error' })
  }
})

console.log("Testcase routes loaded")


// PUT /testcases/:id
router.put('/:id', authenticate, async (req, res) => {
  try {
    const { title, description, priority } = req.body

    const testcase = await prisma.testCase.update({
      where: { id: parseInt(req.params.id) },
      data: { title, description, priority }
    })

    res.json(testcase)
  } catch (err) {
    console.error(err)
    res.status(500).json({ message: 'Internal server error' })
  }
})


// DELETE /testcases/:id
router.delete('/:id', authenticate, async (req, res) => {
  try {
    await prisma.testCase.delete({
      where: { id: parseInt(req.params.id) }
    })

    res.json({ message: 'Testcase deleted successfully' })
  } catch (err) {
    console.error(err)
    res.status(500).json({ message: 'Internal server error' })
  }
})


module.exports = router
