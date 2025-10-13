import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import pool from '../db.js'; // Se usa 'import' y se añade '.js' al final
import { body, validationResult } from 'express-validator';

const router = express.Router();

// --- RUTA DE REGISTRO ---
// POST /api/auth/register
router.post(
  '/register',
  // 1. Validación de seguridad para los datos de entrada
  body('email').isEmail().normalizeEmail(),
  body('password').isLength({ min: 8 }),
  body('fullname').notEmpty().trim().escape(),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ message: "Invalid data provided", errors: errors.array() });
    }

    const { fullname, email, phone, password, role, documentType, documentNumber } = req.body;

    try {
      // 2. Hashear la contraseña antes de guardarla
      const salt = await bcrypt.genSalt(10);
      const password_hash = await bcrypt.hash(password, salt);

      // 3. Guardar el nuevo usuario en la base de datos
      const newUserQuery = `
        INSERT INTO users (fullname, email, phone, password_hash, role, document_type, document_number)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING id, email;
      `;
      const values = [fullname, email, phone, password_hash, role, documentType, documentNumber];
      
      const result = await pool.query(newUserQuery, values);
      
      res.status(201).json({
        message: 'User registered successfully',
        user: result.rows[0],
      });

    } catch (error) {
      if (error.code === '23505') { // Error de email duplicado
        return res.status(409).json({ message: 'Email already exists.' });
      }
      console.error(error);
      res.status(500).json({ message: 'Server error during registration.' });
    }
  }
);

// --- RUTA DE LOGIN ---
// POST /api/auth/login
router.post(
  '/login',
  body('email').isEmail().normalizeEmail(),
  body('password').notEmpty(),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ message: "Invalid data provided" });
    }

    const { email, password } = req.body;

    try {
      // 1. Buscar al usuario por su email
      const userResult = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
      const user = userResult.rows[0];

      if (!user) {
        return res.status(401).json({ message: 'Invalid credentials' });
      }

      // 2. Comparar la contraseña ingresada con el hash guardado
      const isMatch = await bcrypt.compare(password, user.password_hash);

      if (!isMatch) {
        return res.status(401).json({ message: 'Invalid credentials' });
      }

      // 3. Si todo es correcto, crear y firmar un token JWT
      const payload = { userId: user.id, role: user.role };
      const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '1h' });
      
      res.json({ message: 'Login successful', token: token });

    } catch (error) {
      console.error(error);
      res.status(500).json({ message: 'Server error during login.' });
    }
  }
);

export default router; // Se usa 'export default'

