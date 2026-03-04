/**
 * @swagger
 * tags:
 *   name: Authentication
 *   description: User authentication & session management
 */

const crypto = require('crypto')

const express = require("express");
const router = express.Router();

const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const prisma = require("../prisma");



/**
 * @swagger
 * /auth/register:
 *   post:
 *     summary: Register a new user
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password]
 *             properties:
 *               email:
 *                 type: string
 *               password:
 *                 type: string
 *               role:
 *                 type: string
 *                 enum: [TESTER, DEVELOPER]
 *     responses:
 *       201:
 *         description: User registered successfully
 */

/**
 * REGISTER
 * POST /auth/register
 */
const { sendVerificationEmail } = require("../services/email.service");

router.post("/register", async (req, res) => {
  try {
    const {name, email, password, role } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        message: "Email and password are required",
      });
    }

    const allowedRoles = ["TESTER", "DEVELOPER"];
    const selectedRole = role ? role.toUpperCase() : "TESTER";

    if (!allowedRoles.includes(selectedRole)) {
      return res.status(400).json({
        message: "Invalid role selected",
      });
    }

    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      return res.status(409).json({
        message: "User already exists",
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    // 🔐 Generate verification token
    const verificationToken = crypto.randomBytes(32).toString("hex");
    const verificationTokenExpiry = new Date(
      Date.now() + 60 * 60 * 1000
    ); // 1 hour

    const user = await prisma.user.create({
      data: {
        name,
        email,
        password: hashedPassword,
        role: selectedRole,
        verificationToken,
        verificationTokenExpiry,
        isVerified: false,
      },
    });

    await prisma.passwordHistory.create({
      data: {
        userId: user.id,
        password: hashedPassword,
      },
    });

    // 📧 Send REAL email
    await sendVerificationEmail(user.email, verificationToken);

    res.status(201).json({
      message:
        "User registered successfully. Please check your email to verify your account.",
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({
      message: "Internal server error",
    });
  }
});


/**
 * @swagger
 * /auth/verify-email:
 *   get:
 *     summary: Verify user email
 *     tags: [Authentication]
 *     parameters:
 *       - in: query
 *         name: token
 *         required: true
 *         schema:
 *           type: string
 *         description: Email verification token
 *     responses:
 *       200:
 *         description: Email verified successfully
 *       400:
 *         description: Invalid or expired token
 */

/**
 * VERIFY EMAIL
 * GET /auth/verify-email?token=abc123
 */
router.get("/verify-email", async (req, res) => {
  try {
    const { token } = req.query;

    if (!token) {
      return res.status(400).json({ message: "Token is required" });
    }

    const user = await prisma.user.findFirst({
  where: {
    verificationToken: token,
    verificationTokenExpiry: {
      gt: new Date(),
    },
  },
});

    if (!user) {
      return res.status(400).json({
        message: "Invalid or expired verification token",
      });
    }

    await prisma.user.update({
      where: { id: user.id },
      data: {
        isVerified: true,
        verificationToken: null,
        verificationTokenExpiry: null,
      },
    });

    res.json({ message: "Email verified successfully!" });

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Internal server error" });
  }
});

/**
 * @swagger
 * /auth/login:
 *   post:
 *     summary: Login user
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password]
 *             properties:
 *               email:
 *                 type: string
 *                 example: tester@example.com
 *               password:
 *                 type: string
 *                 example: Test@123
 *     responses:
 *       200:
 *         description: Login successful
 *       401:
 *         description: Invalid credentials
 *       403:
 *         description: Email not verified
 */

/**
 * LOGIN
 * POST /auth/login
 */
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: "Email and password are required" });
    }

    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    if (!user.isVerified) {
  return res.status(403).json({
    message: "Please verify your email before logging in",
  });
}

    // 🔑 short-lived access token
    const accessToken = jwt.sign(
      { userId: user.id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: "15m" }
    );

    // 🔁 long-lived refresh token
    const refreshToken = require("crypto")
      .randomBytes(40)
      .toString("hex");

    // store refresh token in DB
    await prisma.user.update({
      where: { id: user.id },
      data: { refreshToken },
    });

    res.json({
      message: "Login successful",
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Internal server error" });
  }
});

/**
 * @swagger
 * /auth/refresh:
 *   post:
 *     summary: Generate new access token using refresh token
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [refreshToken]
 *             properties:
 *               refreshToken:
 *                 type: string
 *     responses:
 *       200:
 *         description: New access token generated
 *       401:
 *         description: Invalid refresh token
 */

/**
 * REFRESH TOKEN
 * POST /auth/refresh-token
 */
router.post("/refresh", async (req, res) => {
  console.log("REFRESH ROUTE HIT");
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(400).json({ message: "Refresh token required" });
    }

    const user = await prisma.user.findFirst({
      where: { refreshToken },
    });

    if (!user) {
      return res.status(401).json({ message: "Invalid refresh token" });
    }

    const newAccessToken = jwt.sign(
      { userId: user.id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: "15m" }
    );

    res.json({
      accessToken: newAccessToken,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Internal server error" });
  }
});

/**
 * @swagger
 * /auth/forgot-password:
 *   post:
 *     summary: Request password reset
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email]
 *             properties:
 *               email:
 *                 type: string
 *     responses:
 *       200:
 *         description: Reset token generated (dev mode)
 *       400:
 *         description: Email required
 */

/*password reset request
POST /auth/request-password-reset
*/
router.post('/forgot-password', async (req, res) => {
  const { email } = req.body

  if (!email) {
    return res.status(400).json({ message: 'Email is required' })
  }

  const user = await prisma.user.findUnique({ where: { email } })

  if (!user) {
    return res.json({ message: 'If user exists, reset link sent' })
  }

  const resetToken = crypto.randomBytes(32).toString('hex')
  const expiry = new Date(Date.now() + 60 * 60 * 1000) // 1 hour

  await prisma.user.update({
    where: { email },
    data: {
      resetToken,
      resetTokenExpiry: expiry,
    },
  })

  // Email will be added later
  res.json({
    message: 'Password reset token generated',
    resetToken, // visible for now (dev only)
  })
})

/**
 * @swagger
 * /auth/reset-password:
 *   post:
 *     summary: Reset password using token
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [token, newPassword]
 *             properties:
 *               token:
 *                 type: string
 *               newPassword:
 *                 type: string
 *     responses:
 *       200:
 *         description: Password reset successful
 *       400:
 *         description: Invalid or expired token
 */

/*reset password
POST /auth/reset-password
*/
router.post('/reset-password', async (req, res) => {
  const { token, newPassword } = req.body

  if (!token || !newPassword) {
    return res.status(400).json({ message: 'Token and new password required' })
  }

  const user = await prisma.user.findFirst({
    where: {
      resetToken: token,
      resetTokenExpiry: { gt: new Date() },
    },
  })

  if (!user) {
    return res.status(400).json({ message: 'Invalid or expired token' })
  }

  // 1️⃣ Fetch last 3 passwords
const lastPasswords = await prisma.passwordHistory.findMany({
  where: { userId: user.id },
  orderBy: { createdAt: "desc" },
  take: 3,
});

// 2️⃣ Compare new password with history
for (const record of lastPasswords) {
  const isSame = await bcrypt.compare(newPassword, record.password);
  if (isSame) {
    return res.status(400).json({
      message: "You cannot reuse your last 3 passwords",
    });
  }
}


  const hashedPassword = await bcrypt.hash(newPassword, 10)

  await prisma.user.update({
  where: { id: user.id },
  data: {
    password: hashedPassword,
    resetToken: null,
    resetTokenExpiry: null,
  },
})

await prisma.passwordHistory.create({
  data: {
    userId: user.id,
    password: hashedPassword,
  },
})

const excess = await prisma.passwordHistory.findMany({
  where: { userId: user.id },
  orderBy: { createdAt: "desc" },
  skip: 3,
});

for (const record of excess) {
  await prisma.passwordHistory.delete({
    where: { id: record.id },
  });
}


  res.json({ message: 'Password reset successful' })
})

/**
 * @swagger
 * /auth/logout:
 *   post:
 *     summary: Logout user and invalidate refresh token
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [refreshToken]
 *             properties:
 *               refreshToken:
 *                 type: string
 *     responses:
 *       200:
 *         description: Logged out successfully
 *       400:
 *         description: Refresh token required
 */

/**
 * LOGOUT
 * POST /auth/logout
 */
router.post("/logout", async (req, res) => {
  console.log("LOGOUT ROUTE HIT");
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(400).json({ message: "Refresh token required" });
    }

    await prisma.user.updateMany({
      where: { refreshToken },
      data: { refreshToken: null },
    });

    res.json({ message: "Logged out successfully" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Internal server error" });
  }
});

/**
 * DELETE OWN ACCOUNT
 * DELETE /auth/me
 */
const { authenticate } = require("../middleware/auth");

router.delete("/me", authenticate, async (req, res) => {
  try {
    const userId = req.user.userId;

    // Delete related records
    await prisma.notification.deleteMany({ where: { userId } });
    await prisma.bugComment.deleteMany({ where: { userId } });
    await prisma.passwordHistory.deleteMany({ where: { userId } });
    await prisma.passwordReset.deleteMany({ where: { userId } });
    await prisma.refreshToken.deleteMany({ where: { userId } });
    await prisma.testExecution.deleteMany({ where: { executedBy: userId } });

    // Remove bug relations
    await prisma.bug.updateMany({
      where: { assignedToId: userId },
      data: { assignedToId: null },
    });

    await prisma.bug.updateMany({
      where: { createdById: userId },
      data: { createdById: null },
    });

    // Finally delete user
    await prisma.user.delete({
      where: { id: userId },
    });

    res.json({ message: "Account deleted successfully" });

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Failed to delete account" });
  }
});

router.get("/me", authenticate, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.userId }, // IMPORTANT FIX
      select: {
        id: true,
        name: true,
        email: true,
        role: true
      }
    });

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    res.json(user);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Failed to fetch user" });
  }
});

router.patch("/me", authenticate, async (req, res) => {
  try {
    const { name } = req.body

    const updatedUser = await prisma.user.update({
      where: { id: req.user.userId },
      data: { name },
      select: {
        id: true,
        name: true,
        email: true,
        role: true
      }
    })

    res.json(updatedUser)
  } catch (error) {
    console.error(error)
    res.status(500).json({ message: "Failed to update profile" })
  }
})

module.exports = router;
