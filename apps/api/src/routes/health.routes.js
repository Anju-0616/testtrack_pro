/**
 * @swagger
 * tags:
 *   name: Health
 *   description: API Health Check
 */

const express = require("express");
const router = express.Router();

/**
 * @swagger
 * /health:
 *   get:
 *     summary: Check API health status
 *     tags: [Health]
 *     responses:
 *       200:
 *         description: API is healthy
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: API is healthy 🚀
 */

router.get("/health", (req, res) => {
  res.json({ status: "API is healthy 🚀" });
});

module.exports = router;
