const express = require("express");
const router = express.Router();
const pool = require("../config/database");
const bcrypt = require("bcrypt");
const { isAuthenticated, hasPermission } = require("../middleware/auth");
const upload = require("../middleware/upload"); 

// Liste Admin
router.get("/", isAuthenticated, hasPermission('manage_users'), async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT u.id, u.username, u.first_name, u.last_name, u.badge_number, u.grade_id, u.is_active,
      g.name as grade_name, g.category as grade_category, g.level as grade_level, g.color as grade_color
      FROM users u LEFT JOIN grades g ON u.grade_id = g.id ORDER BY g.level DESC, u.last_name
    `);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: "Erreur serveur" });
  }
});

// Effectifs (Public Interne)
router.get("/roster", isAuthenticated, hasPermission('view_roster'), async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        u.id, u.first_name, u.last_name, u.badge_number, u.profile_picture, u.phone,
        g.name as grade_name, g.category as grade_category, g.level as grade_level, g.color as grade_color
      FROM users u 
      LEFT JOIN grades g ON u.grade_id = g.id 
      WHERE u.is_active = true 
      ORDER BY g.level DESC, u.badge_number ASC
    `);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: "Erreur serveur" });
  }
});

// Profil personnel
router.get("/me/stats", isAuthenticated, async (req, res) => {
   // Placeholder stats pour éviter crash
   res.json({ my_reports: 0, my_patients: 0, my_appointments: 0, recent_activity: [] });
});

router.put("/me", isAuthenticated, upload.single('profile_picture'), async (req, res) => {
  try {
    const { first_name, last_name, phone, password } = req.body;
    let fields = ["first_name=$1", "last_name=$2", "phone=$3", "updated_at=CURRENT_TIMESTAMP"];
    let params = [first_name, last_name, phone];
    let paramIndex = 4;

    if (password && password.trim() !== "") {
        const hashedPassword = await bcrypt.hash(password, 10);
        fields.push(`password=$${paramIndex}`);
        params.push(hashedPassword);
        paramIndex++;
    }

    if (req.file) {
        fields.push(`profile_picture=$${paramIndex}`);
        const b64 = req.file.buffer.toString('base64');
        const mime = req.file.mimetype;
        const photoData = `data:${mime};base64,${b64}`;
        params.push(photoData);
        paramIndex++;
    }

    params.push(req.user.id);
    await pool.query(`UPDATE users SET ${fields.join(", ")} WHERE id=$${paramIndex}`, params);
    
    const updated = await pool.query(`SELECT u.*, g.name as grade_name FROM users u LEFT JOIN grades g ON u.grade_id = g.id WHERE u.id = $1`, [req.user.id]);
    res.json({ success: true, user: updated.rows[0] });
  } catch (err) { res.status(500).json({ error: "Erreur serveur" }); }
});

module.exports = router;
