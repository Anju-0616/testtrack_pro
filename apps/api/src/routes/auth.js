const crypto = require('crypto')

const express = require("express");
const router = express.Router();

const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const prisma = require("../prisma");

/**
 * REGISTER
 * POST /auth/register
 */
router.post("/register", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: "Email and password are required" });
    }

    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      return res.status(409).json({ message: "User already exists" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        role:"TESTER",
      },
    });

    await prisma.passwordHistory.create({
  data: {
    userId: user.id,
    password: hashedPassword,
  },
});


    res.status(201).json({
      message: "User registered successfully",
      user: {
        id: user.id,
        email: user.email,
      },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Internal server error" });
  }
});

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

module.exports = router;
