const express = require("express");
const router = express.Router();
const pool = require("../config/database");
const bcrypt = require("bcrypt");
const { isAuthenticated, hasPermission } = require("../middleware/auth");
const upload = require("../middleware/upload");
const logAction = require("../utils/logger");

// ============================================================================
// EFFECTIFS (Roster) - Vue publique interne avec grades visibles
// Permission: view_roster
// ============================================================================
router.get("/roster", isAuthenticated, hasPermission('view_roster'), async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        u.id, 
        u.first_name, 
        u.last_name, 
        u.badge_number, 
        u.profile_picture, 
        u.phone,
        -- Affiche le grade visible si défini, sinon le vrai grade
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
    console.error("❌ Erreur Roster:", err);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

// ============================================================================
// STATS PERSONNELLES (Dashboard utilisateur)
// ============================================================================
router.get("/me/stats", isAuthenticated, async (req, res) => {
  try {
    const userId = req.user.id;

    const [appointmentsCompleted, patientsCreated, recentActivity] = await Promise.all([
      pool.query(
        "SELECT COUNT(*) FROM appointments WHERE assigned_medic_id = $1 AND status = 'completed'", 
        [userId]
      ),
      pool.query(
        "SELECT COUNT(*) FROM patients WHERE created_by = $1", 
        [userId]
      ),
      pool.query(`
        SELECT 
          a.id, 
          a.appointment_type as title, 
          a.description, 
          a.created_at as date, 
          a.patient_name,
          a.status
        FROM appointments a 
        WHERE a.assigned_medic_id = $1 OR a.completed_by_id = $1
        ORDER BY a.updated_at DESC 
        LIMIT 5
      `, [userId])
    ]);

    res.json({
      my_reports: 0,
      my_patients: parseInt(patientsCreated.rows[0]?.count || 0),
      my_appointments: parseInt(appointmentsCompleted.rows[0]?.count || 0),
      recent_activity: recentActivity.rows
    });
  } catch (err) {
    console.error("❌ Erreur Stats Perso:", err);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

// ============================================================================
// MODIFICATION PROFIL PERSONNEL
// Un utilisateur ne peut modifier QUE son propre profil ici
// Pour modifier d'autres utilisateurs: /api/admin/users/:id
// ============================================================================
router.put("/me", isAuthenticated, upload.single('profile_picture'), async (req, res) => {
  try {
    const { first_name, last_name, phone, password } = req.body;

    // Validation
    if (!first_name?.trim() || !last_name?.trim()) {
      return res.status(400).json({ error: "Nom et prénom sont requis" });
    }

    const updates = [
      "first_name = $1",
      "last_name = $2",
      "phone = $3",
      "updated_at = CURRENT_TIMESTAMP"
    ];
    const params = [first_name.trim(), last_name.trim(), phone || null];
    let paramIndex = 4;

    // Changement de mot de passe (optionnel)
    if (password && password.trim() !== "") {
      if (password.length < 4) {
        return res.status(400).json({ error: "Mot de passe trop court (min 4 caractères)" });
      }
      const hashedPassword = await bcrypt.hash(password, 12);
      updates.push(`password = $${paramIndex}`);
      params.push(hashedPassword);
      paramIndex++;
    }

    // Photo de profil (optionnel)
    if (req.file) {
      const b64 = req.file.buffer.toString('base64');
      const mime = req.file.mimetype;
      const photoData = `data:${mime};base64,${b64}`;
      updates.push(`profile_picture = $${paramIndex}`);
      params.push(photoData);
      paramIndex++;
    }

    params.push(req.user.id);
    
    await pool.query(
      `UPDATE users SET ${updates.join(", ")} WHERE id = $${paramIndex}`,
      params
    );

    // Log de l'action
    await logAction(req.user.id, "UPDATE_PROFILE", "Mise à jour du profil personnel", 'user', req.user.id, req);

    // Renvoyer les données mises à jour
    const updated = await pool.query(`
      SELECT 
        u.id, u.username, u.first_name, u.last_name, u.badge_number, 
        u.is_admin, u.profile_picture, u.phone,
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
  } catch (err) {
    console.error("❌ Erreur Update Profil:", err);
    res.status(500).json({ error: "Erreur serveur lors de la mise à jour du profil" });
  }
});

module.exports = router;
