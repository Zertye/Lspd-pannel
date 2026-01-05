const express = require("express");
const router = express.Router();
const pool = require("../config/database");
const bcrypt = require("bcrypt");
const { isAuthenticated, isAdmin } = require("../middleware/auth");
const logAction = require("../utils/logger");

// STATS LSPD
router.get("/stats", isAuthenticated, async (req, res) => {
  try {
    const users = await pool.query("SELECT COUNT(*) as total FROM users WHERE is_active = true");
    const appointments = await pool.query("SELECT COUNT(*) as pending FROM appointments WHERE status = 'pending'");
    res.json({
      users: users.rows[0],
      appointments: appointments.rows[0],
      reports: { total: 0 }, 
      patients: { total: 0 }
    });
  } catch (err) { res.status(500).json({ error: "Erreur serveur" }); }
});

router.get("/users", isAuthenticated, isAdmin, async (req, res) => {
  const result = await pool.query(`SELECT u.*, g.name as grade_name FROM users u LEFT JOIN grades g ON u.grade_id = g.id ORDER BY u.id DESC`);
  res.json(result.rows);
});

router.post("/users", isAuthenticated, isAdmin, async (req, res) => {
  try {
    const { username, password, first_name, last_name, badge_number, grade_id } = req.body;
    const hashedPassword = await bcrypt.hash(password, 10);
    await pool.query(
      `INSERT INTO users (username, password, first_name, last_name, badge_number, grade_id, is_active) VALUES ($1, $2, $3, $4, $5, $6, TRUE)`,
      [username, hashedPassword, first_name, last_name, badge_number, grade_id]
    );
    await logAction(req.user.id, "CREATE_USER", `Ajout officier ${first_name} ${last_name}`, null);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: "Erreur création" }); }
});

router.delete("/users/:id", isAuthenticated, isAdmin, async (req, res) => {
  if (parseInt(req.params.id) === req.user.id) return res.status(400).json({ error: "Impossible de se supprimer soi-même" });
  await pool.query("DELETE FROM users WHERE id = $1", [req.params.id]);
  await logAction(req.user.id, "DELETE_USER", `Suppression utilisateur ID ${req.params.id}`, req.params.id);
  res.json({ success: true });
});

router.get("/grades", isAuthenticated, async (req, res) => {
  const result = await pool.query("SELECT * FROM grades ORDER BY level ASC");
  res.json(result.rows);
});

module.exports = router;
