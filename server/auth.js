import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import pool from "./db.js";
import dotenv from "dotenv";

dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET || "change-this-in-production";
const TOKEN_EXPIRY = "7d";

// ── Create a new user ────────────────────────────────────────
export async function createUser(email, name, password, role = "member") {
  const passwordHash = await bcrypt.hash(password, 10);
  const result = await pool.query(
    "INSERT INTO users (email, name, password_hash, role) VALUES ($1, $2, $3, $4) RETURNING id, email, name, role",
    [email.toLowerCase().trim(), name, passwordHash, role]
  );
  return result.rows[0];
}

// ── Login ────────────────────────────────────────────────────
export async function loginUser(email, password) {
  const result = await pool.query(
    "SELECT * FROM users WHERE email = $1",
    [email.toLowerCase().trim()]
  );

  if (result.rows.length === 0) {
    throw new Error("Invalid email or password");
  }

  const user = result.rows[0];
  const validPassword = await bcrypt.compare(password, user.password_hash);

  if (!validPassword) {
    throw new Error("Invalid email or password");
  }

  const token = jwt.sign(
    { id: user.id, email: user.email, name: user.name, role: user.role },
    JWT_SECRET,
    { expiresIn: TOKEN_EXPIRY }
  );

  return {
    token,
    user: { id: user.id, email: user.email, name: user.name, role: user.role },
  };
}

// ── Middleware: Verify JWT ────────────────────────────────────
export function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Not authenticated" });
  }

  try {
    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
}

// ── Admin-only middleware ────────────────────────────────────
export function adminMiddleware(req, res, next) {
  if (req.user?.role !== "admin") {
    return res.status(403).json({ error: "Admin access required" });
  }
  next();
}

// ── Get all team members ─────────────────────────────────────
export async function getTeamMembers() {
  const result = await pool.query(
    "SELECT id, email, name, role, created_at FROM users ORDER BY name"
  );
  return result.rows;
}

// ── Seed initial admin user if none exist ────────────────────
export async function seedAdminUser() {
  const result = await pool.query("SELECT COUNT(*) FROM users");
  if (parseInt(result.rows[0].count) === 0) {
    await createUser("jon@getoveralls.com", "Jon Cooper", "overalls2026", "admin");
    console.log("✅ Default admin user created: jon@getoveralls.com / overalls2026");
    console.log("   ⚠️  CHANGE THIS PASSWORD after first login!");
  }
}
