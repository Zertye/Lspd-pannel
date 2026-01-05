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

// Effectifs (Vue publique interne)
router.get("/roster", isAuthenticated, hasPermission('view_roster'), async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        u.id, u.first_name, u.last_name, u.badge_number, u.profile_picture, u.phone,
        COALESCE(vg.name, g.name) as grade_name,
        COALESCE(vg.category, g.category) as grade_category,
        COALESCE(vg.level, g.level) as grade_level,
        COALESCE(vg.color, g.color) as grade_color
      FROM users u 
      LEFT JOIN grades g ON u.grade_id = g.id 
      LEFT JOIN grades vg ON u.visible_grade_id = vg.id
      WHERE u.is_active = true 
      ORDER BY COALESCE(vg.level, g.level) DESC, u.last_name ASC
    `);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: "Erreur serveur" });
  }
});

// Stats Personnelles (Dashboard - CALCUL RÉEL)
router.get("/me/stats", isAuthenticated, async (req, res) => {
  try {
    const userId = req.user.id;
    
    // On récupère les vraies stats : Plaintes traitées, Dossiers créés (patients table utilisé comme casier civil)
    const [appointments, createdFiles] = await Promise.all([
      pool.query("SELECT COUNT(*) FROM appointments WHERE assigned_medic_id = $1 AND status = 'completed'", [userId]),
      pool.query("SELECT COUNT(*) FROM patients WHERE created_by = $1", [userId])
    ]);

    // On récupère l'activité récente (Dernières plaintes assignées)
    const recentActivity = await pool.query(`
        SELECT a.id, a.appointment_type as title, a.description, a.created_at as date, a.patient_name
        FROM appointments a 
        WHERE a.assigned_medic_id = $1 
        ORDER BY a.created_at DESC 
        LIMIT 5
    `, [userId]);

    res.json({
      my_reports: 0, // Placeholder pour futurs rapports d'arrestation
      my_patients: parseInt(createdFiles.rows[0]?.count || 0), // Civils enregistrés
      my_appointments: parseInt(appointments.rows[0]?.count || 0), // Plaintes traitées
      recent_activity: recentActivity.rows // Historique réel
    });
  } catch (err) {
    console.error("Erreur Stats Perso:", err);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

// Profil personnel
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
    
    // Refresh user data pour la session
    const updated = await pool.query(`
      SELECT 
        u.id, u.username, u.first_name, u.last_name, u.badge_number, u.is_admin, u.profile_picture, u.phone,
        COALESCE(vg.name, g.name) as grade_name,
        COALESCE(vg.color, g.color) as grade_color,
        g.level as grade_level,
        g.permissions as grade_permissions
      FROM users u
      LEFT JOIN grades g ON u.grade_id = g.id
      LEFT JOIN grades vg ON u.visible_grade_id = vg.id
      WHERE u.id = $1
    `, [req.user.id]);

    res.json({ success: true, user: updated.rows[0] });
  } catch (err) { res.status(500).json({ error: "Erreur serveur" }); }
});

module.exports = router;
