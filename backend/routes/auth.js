const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");
const User = require("../models/User");
const authMiddleware = require("../middleware/auth");

const router = express.Router();

const isDatabaseConnected = () => mongoose.connection.readyState === 1;

const ensureBackendReady = (res) => {
  if (!isDatabaseConnected()) {
    return res.status(503).json({ error: "Database unavailable. Check MongoDB connection settings." });
  }

  if (!process.env.JWT_SECRET) {
    return res.status(500).json({ error: "Server authentication is not configured." });
  }

  return null;
};

// Helper: generate JWT
const generateToken = (user) => {
  return jwt.sign(
    { id: user._id, username: user.username, email: user.email },
    process.env.JWT_SECRET,
    { expiresIn: "7d" }
  );
};

// ────────────────────────────────────────
// POST /api/auth/signup
// ────────────────────────────────────────
router.post("/signup", async (req, res) => {
  try {
    const notReady = ensureBackendReady(res);
    if (notReady) return notReady;

    const { username, email, password } = req.body;

    if (!username || !email || !password) {
      return res.status(400).json({ error: "All fields are required" });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: "Password must be at least 6 characters" });
    }

    // Check uniqueness
    const existingUser = await User.findOne({ $or: [{ email: email.toLowerCase() }, { username }] });
    if (existingUser) {
      if (existingUser.email === email.toLowerCase()) {
        return res.status(400).json({ error: "Email already registered" });
      }
      return res.status(400).json({ error: "Username already taken" });
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const user = await User.create({
      username,
      email: email.toLowerCase(),
      passwordHash,
      verified: true, // auto-verified
    });

    const token = generateToken(user);
    res.json({
      message: "Account created successfully!",
      token,
      user: { username: user.username, email: user.email },
    });
  } catch (err) {
    console.error("Signup error:", err);
    if (err.code === 11000) {
      return res.status(400).json({ error: "Email or username already registered" });
    }
    res.status(500).json({ error: "Server error" });
  }
});

// ────────────────────────────────────────
// POST /api/auth/login
// ────────────────────────────────────────
router.post("/login", async (req, res) => {
  try {
    const notReady = ensureBackendReady(res);
    if (notReady) return notReady;

    const { identifier, password } = req.body;

    if (!identifier || !password) {
      return res.status(400).json({ error: "Email/username and password are required" });
    }

    // Find by email or username
    const user = await User.findOne({
      $or: [
        { email: identifier.toLowerCase() },
        { username: identifier },
      ],
    });

    if (!user) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const token = generateToken(user);
    res.json({ token, user: { username: user.username, email: user.email } });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// ────────────────────────────────────────
// GET /api/auth/me  (protected)
// ────────────────────────────────────────
router.get("/me", authMiddleware, async (req, res) => {
  try {
    if (!isDatabaseConnected()) {
      return res.status(503).json({ error: "Database unavailable. Check MongoDB connection settings." });
    }

    const user = await User.findById(req.user.id).select("-passwordHash");
    if (!user) return res.status(404).json({ error: "User not found" });
    res.json({ username: user.username, email: user.email });
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

module.exports = router;
