// routes/auth.js
import express from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { pool } from "../db.js";
import dotenv from "dotenv";

dotenv.config();
const router = express.Router();

/**
 * Register new user
 */
router.post("/register", async (req, res) => {
  try {
    const {
      fullname,
      email,
      phone,
      password,
      role = "user",   // por defecto 'user' si no se envía
      documentType,
      documentNumber
    } = req.body;

    if (!fullname || !email || !phone || !password || !documentType || !documentNumber) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    // Verificar si ya existe el usuario
    const exist = await pool.query("SELECT id FROM users WHERE email = $1", [email]);
    if (exist.rowCount > 0) {
      return res.status(400).json({ error: "Email already registered" });
    }

    // Encriptar la contraseña
    const hash = await bcrypt.hash(password, 10);

    // Obtener role_id
    let roleId;
    const roleRes = await pool.query("SELECT id FROM roles WHERE name = $1", [role]);
    if (roleRes.rowCount > 0) {
      roleId = roleRes.rows[0].id;
    } else {
      // si no existe el rol, asignar el rol "user"
      const defaultRole = await pool.query("SELECT id FROM roles WHERE name = 'user'");
      roleId = defaultRole.rows[0].id;
    }

    // Insertar en la BD
    const insert = await pool.query(
      `INSERT INTO users (fullname, email, phone, password_hash, role_id, document_type, document_number)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id, fullname, email, role_id`,
      [fullname, email, phone, hash, roleId, documentType, documentNumber]
    );

    const user = insert.rows[0];
    res.json({
      message: "User registered successfully",
      user: { id: user.id, fullname: user.fullname, email: user.email }
    });
  } catch (err) {
    console.error("Error in /register:", err);
    res.status(500).json({ error: "Server error" });
  }
});

/**
 * Login user
 */
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password)
      return res.status(400).json({ error: "Missing email or password" });

    // Buscar usuario
    const result = await pool.query(
      "SELECT u.*, r.name as role_name FROM users u LEFT JOIN roles r ON u.role_id = r.id WHERE email = $1",
      [email]
    );

    if (result.rowCount === 0) return res.status(400).json({ error: "Invalid credentials" });

    const user = result.rows[0];

    // Validar contraseña
    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) return res.status(401).json({ error: "Invalid credentials" });

    // Generar JWT
    const payload = { id: user.id, email: user.email, role: user.role_name || "user" };
    const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: "8h" });

    res.json({
      message: "Login successful",
      token,
      user: { id: user.id, fullname: user.fullname, email: user.email, role: payload.role }
    });
  } catch (err) {
    console.error("Error in /login:", err);
    res.status(500).json({ error: "Server error" });
  }
});

export default router;
