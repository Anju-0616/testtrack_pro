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
const { sendVerificationEmail } = require("../services/email.service");
const { authenticate } = require("../middleware/auth");

// ─────────────────────────────────────────────────────────────────────────────
// REGISTER
// ─────────────────────────────────────────────────────────────────────────────
router.post("/register", async (req, res) => {
  try {
    const { name, email, password, role } = req.body;

    if (!email || !password)
      return res.status(400).json({ message: "Email and password are required" });

    const allowedRoles = ["TESTER", "DEVELOPER"];
    const selectedRole = role ? role.toUpperCase() : "TESTER";

    if (!allowedRoles.includes(selectedRole))
      return res.status(400).json({ message: "Invalid role selected" });

    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser)
      return res.status(409).json({ message: "User already exists" });

    const hashedPassword = await bcrypt.hash(password, 10);
    const verificationToken = crypto.randomBytes(32).toString("hex");
    const verificationTokenExpiry = new Date(Date.now() + 60 * 60 * 1000);

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
      data: { userId: user.id, password: hashedPassword },
    });

    await sendVerificationEmail(user.email, verificationToken);

    res.status(201).json({
      message: "User registered successfully. Please check your email to verify your account.",
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Internal server error" });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// VERIFY EMAIL
// ─────────────────────────────────────────────────────────────────────────────
router.get("/verify-email", async (req, res) => {
  try {
    const { token } = req.query;
    if (!token) return res.status(400).json({ message: "Token is required" });

    const user = await prisma.user.findFirst({
      where: {
        verificationToken: token,
        verificationTokenExpiry: { gt: new Date() },
      },
    });

    if (!user)
      return res.status(400).json({ message: "Invalid or expired verification token" });

    await prisma.user.update({
      where: { id: user.id },
      data: { isVerified: true, verificationToken: null, verificationTokenExpiry: null },
    });

    res.json({ message: "Email verified successfully!" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Internal server error" });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// LOGIN  ✅ FIXED: uses RefreshToken table instead of user.refreshToken field
// ─────────────────────────────────────────────────────────────────────────────
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password)
      return res.status(400).json({ message: "Email and password are required" });

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user)
      return res.status(401).json({ message: "Invalid credentials" });

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid)
      return res.status(401).json({ message: "Invalid credentials" });

    if (!user.isVerified)
      return res.status(403).json({ message: "Please verify your email before logging in" });

    const accessToken = jwt.sign(
      { userId: user.id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: "15m" }
    );

    const refreshToken = crypto.randomBytes(40).toString("hex");
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    // ✅ Save to RefreshToken table (not on User directly)
    await prisma.refreshToken.create({
      data: {
        token: refreshToken,
        userId: user.id,
        expiresAt,
      },
    });

    res.json({
      message: "Login successful",
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Internal server error" });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// REFRESH TOKEN  ✅ FIXED: looks up RefreshToken table
// ─────────────────────────────────────────────────────────────────────────────
router.post("/refresh", async (req, res) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken)
      return res.status(400).json({ message: "Refresh token required" });

    // ✅ Look up in RefreshToken table
    const tokenRecord = await prisma.refreshToken.findFirst({
      where: {
        token: refreshToken,
        expiresAt: { gt: new Date() },
      },
      include: { user: true },
    });

    if (!tokenRecord)
      return res.status(401).json({ message: "Invalid or expired refresh token" });

    const newAccessToken = jwt.sign(
      { userId: tokenRecord.user.id, role: tokenRecord.user.role },
      process.env.JWT_SECRET,
      { expiresIn: "15m" }
    );

    res.json({ accessToken: newAccessToken });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Internal server error" });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// FORGOT PASSWORD
// ─────────────────────────────────────────────────────────────────────────────
router.post('/forgot-password', async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ message: 'Email is required' });

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) return res.json({ message: 'If user exists, reset link sent' });

  const resetToken = crypto.randomBytes(32).toString('hex');
  const expiry = new Date(Date.now() + 60 * 60 * 1000);

  await prisma.user.update({
    where: { email },
    data: { resetToken, resetTokenExpiry: expiry },
  });

  res.json({ message: 'Password reset token generated', resetToken });
});

// ─────────────────────────────────────────────────────────────────────────────
// RESET PASSWORD
// ─────────────────────────────────────────────────────────────────────────────
router.post('/reset-password', async (req, res) => {
  const { token, newPassword } = req.body;
  if (!token || !newPassword)
    return res.status(400).json({ message: 'Token and new password required' });

  const user = await prisma.user.findFirst({
    where: { resetToken: token, resetTokenExpiry: { gt: new Date() } },
  });

  if (!user) return res.status(400).json({ message: 'Invalid or expired token' });

  const lastPasswords = await prisma.passwordHistory.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    take: 3,
  });

  for (const record of lastPasswords) {
    const isSame = await bcrypt.compare(newPassword, record.password);
    if (isSame)
      return res.status(400).json({ message: "You cannot reuse your last 3 passwords" });
  }

  const hashedPassword = await bcrypt.hash(newPassword, 10);

  await prisma.user.update({
    where: { id: user.id },
    data: { password: hashedPassword, resetToken: null, resetTokenExpiry: null },
  });

  await prisma.passwordHistory.create({
    data: { userId: user.id, password: hashedPassword },
  });

  const excess = await prisma.passwordHistory.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    skip: 3,
  });
  for (const record of excess)
    await prisma.passwordHistory.delete({ where: { id: record.id } });

  res.json({ message: 'Password reset successful' });
});

// ─────────────────────────────────────────────────────────────────────────────
// LOGOUT  ✅ FIXED: deletes from RefreshToken table
// ─────────────────────────────────────────────────────────────────────────────
router.post("/logout", async (req, res) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken)
      return res.status(400).json({ message: "Refresh token required" });

    // ✅ Delete from RefreshToken table
    await prisma.refreshToken.deleteMany({
      where: { token: refreshToken },
    });

    res.json({ message: "Logged out successfully" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Internal server error" });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// DELETE ACCOUNT
// ─────────────────────────────────────────────────────────────────────────────
router.delete("/me", authenticate, async (req, res) => {
  try {
    const userId = req.user.userId;

    await prisma.notification.deleteMany({ where: { userId } });
    await prisma.bugComment.deleteMany({ where: { userId } });
    await prisma.passwordHistory.deleteMany({ where: { userId } });
    await prisma.passwordReset.deleteMany({ where: { userId } });
    await prisma.refreshToken.deleteMany({ where: { userId } });
    await prisma.testExecution.deleteMany({ where: { executedBy: userId } });

    await prisma.bug.updateMany({ where: { assignedToId: userId }, data: { assignedToId: null } });
    await prisma.bug.updateMany({ where: { createdById: userId }, data: { createdById: null } });

    await prisma.user.delete({ where: { id: userId } });

    res.json({ message: "Account deleted successfully" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Failed to delete account" });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET / UPDATE PROFILE
// ─────────────────────────────────────────────────────────────────────────────
router.get("/me", authenticate, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.userId },
      select: { id: true, name: true, email: true, role: true },
    });

    if (!user) return res.status(404).json({ message: "User not found" });
    res.json(user);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Failed to fetch user" });
  }
});

router.patch("/me", authenticate, async (req, res) => {
  try {
    const { name } = req.body;
    const updatedUser = await prisma.user.update({
      where: { id: req.user.userId },
      data: { name },
      select: { id: true, name: true, email: true, role: true },
    });
    res.json(updatedUser);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Failed to update profile" });
  }
});

module.exports = router;