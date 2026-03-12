/**
 * @swagger
 * tags:
 *   name: Reports
 *   description: Bug analytics and export reports
 */

const express = require("express")
const prisma = require("../prisma")
const { authenticate } = require("../middleware/auth")
const { Parser } = require("json2csv")
const PDFDocument = require("pdfkit")

const router = express.Router()


/**
 * @swagger
 * /reports:
 *   get:
 *     summary: Get bug analytics report
 *     tags: [Reports]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: days
 *         schema:
 *           type: integer
 *         description: Number of days to include in report
 *         example: 7
 *     responses:
 *       200:
 *         description: Bug report summary
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 summary:
 *                   type: object
 *                   properties:
 *                     total:
 *                       type: integer
 *                     open:
 *                       type: integer
 *                     inProgress:
 *                       type: integer
 *                     fixed:
 *                       type: integer
 *                 priorityChart:
 *                   type: array
 *                   items:
 *                     type: object
 *                 severityChart:
 *                   type: array
 *                   items:
 *                     type: object
 */
/*
  GET /reports?days=7
*/
router.get("/", authenticate, async (req, res) => {
  try {
    const days = parseInt(req.query.days) || 30

    const fromDate = new Date()
    fromDate.setDate(fromDate.getDate() - days)

    // 🔐 ROLE-BASED FILTER
    let whereClause = {
      createdAt: { gte: fromDate }
    }

    if (req.user.role === "DEVELOPER") {
      whereClause.assignedToId = req.user.userId
    }

    if (req.user.role === "TESTER") {
      whereClause.createdById = req.user.userId
    }

    const bugs = await prisma.bug.findMany({
      where: whereClause
    })

    const summary = {
      total: bugs.length,
      open: bugs.filter(b => b.status === "OPEN").length,
      inProgress: bugs.filter(b => b.status === "IN_PROGRESS").length,
      fixed: bugs.filter(b => b.status === "FIXED").length
    }

    const priorityChart = await prisma.bug.groupBy({
      by: ["priority"],
      _count: { priority: true },
      where: whereClause
    })

    const severityChart = await prisma.bug.groupBy({
      by: ["severity"],
      _count: { severity: true },
      where: whereClause
    })

    res.json({
      summary,
      priorityChart,
      severityChart
    })

  } catch (error) {
    console.error(error)
    res.status(500).json({ message: "Failed to fetch reports" })
  }
})

/**
 * @swagger
 * /reports/export-csv:
 *   get:
 *     summary: Export bug report as CSV
 *     tags: [Reports]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: CSV file download
 *         content:
 *           text/csv:
 *             schema:
 *               type: string
 */
/*
  GET /reports/export-csv
*/
router.get("/export-csv", authenticate, async (req, res) => {
  try {
    let whereClause = {}

    if (req.user.role === "DEVELOPER") {
      whereClause.assignedToId = req.user.userId
    }

    if (req.user.role === "TESTER") {
      whereClause.createdById = req.user.userId
    }

    const bugs = await prisma.bug.findMany({
      where: whereClause
    })

    const parser = new Parser()
    const csv = parser.parse(bugs)

    res.header("Content-Type", "text/csv")
    res.attachment("bug-report.csv")
    res.send(csv)

  } catch (error) {
    console.error(error)
    res.status(500).json({ message: "CSV export failed" })
  }
})

/**
 * @swagger
 * /reports/export-pdf:
 *   get:
 *     summary: Export bug report as PDF
 *     tags: [Reports]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: PDF file download
 *         content:
 *           application/pdf:
 *             schema:
 *               type: string
 */
/*
  GET /reports/export-pdf
*/
router.get("/export-pdf", authenticate, async (req, res) => {
  try {
    let whereClause = {}

    if (req.user.role === "DEVELOPER") {
      whereClause.assignedToId = req.user.userId
    }

    if (req.user.role === "TESTER") {
      whereClause.createdById = req.user.userId
    }

    const bugs = await prisma.bug.findMany({
      where: whereClause
    })

    const doc = new PDFDocument()

    res.setHeader("Content-Type", "application/pdf")
    res.setHeader(
      "Content-Disposition",
      "attachment; filename=bug-report.pdf"
    )

    doc.pipe(res)

    doc.fontSize(18).text("Bug Report Summary", { align: "center" })
    doc.moveDown()

    bugs.forEach(bug => {
      doc.fontSize(12).text(
        `#${bug.id} - ${bug.title} | ${bug.priority} | ${bug.status}`
      )
    })

    doc.end()

  } catch (error) {
    console.error(error)
    res.status(500).json({ message: "PDF export failed" })
  }
})

module.exports = router