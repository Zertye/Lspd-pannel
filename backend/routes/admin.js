const express = require("express");
const router = express.Router();
const pool = require("../config/database");
const bcrypt = require("bcrypt");
const { 
  isAuthenticated, 
  hasPermission, 
  canActOnUser, 
  canAssignGrade,
  canModifyGrade 
} = require("../middleware/auth");
const logAction = require("../utils/logger");

// ============================================================================
// STATISTIQUES GLOBALES
// ============================================================================
router.get("/stats", isAuthenticated, hasPermission('access_dashboard'), async (req, res) => {
  try {
    const [users, patients, appointments, gradeDistribution] = await Promise.all([
      pool.query("SELECT COUNT(*) as total, COUNT(*) FILTER (WHERE is_active) as active FROM users"),
      pool.query("SELECT COUNT(*) as total FROM patients"),
      pool.query("SELECT COUNT(*) as total, COUNT(*) FILTER (WHERE status='pending') as pending FROM appointments"),
      pool.query(`
        SELECT g.name, g.color, COUNT(u.id) as count 
        FROM grades g 
        LEFT JOIN users u ON u.grade_id = g.id AND u.is_active = true
        GROUP BY g.id, g.name, g.color 
        ORDER BY g.level DESC
      `)
    ]);

    res.json({
      users: users.rows[0],
      patients: patients.rows[0],
      appointments: appointments.rows[0],
      reports: { total: 0 },
      gradeDistribution: gradeDistribution.rows
    });
  } catch (err) {
    console.error("❌ Erreur Stats Admin:", err);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

// ============================================================================
// PERFORMANCE & LOGS
// ============================================================================
router.get("/performance", isAuthenticated, hasPermission('view_logs'), async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        u.id, u.first_name, u.last_name, u.badge_number,
        g.name as grade_name, g.color as grade_color,
        (SELECT COUNT(*) FROM patients WHERE created_by = u.id) as patients_created,
        (SELECT COUNT(*) FROM appointments WHERE assigned_medic_id = u.id AND status = 'completed') as appointments_completed,
        (SELECT COUNT(*) FROM logs WHERE user_id = u.id) as total_actions
      FROM users u
      LEFT JOIN grades g ON u.grade_id = g.id
      WHERE u.is_active = true
      ORDER BY appointments_completed DESC
    `);
    res.json(result.rows);
  } catch (err) {
    console.error("❌ Erreur Performance:", err);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

router.get("/logs", isAuthenticated, hasPermission('view_logs'), async (req, res) => {
  try {
    const { limit = 100, offset = 0, action, user_id } = req.query;
    
    let query = `
      SELECT l.*, u.first_name, u.last_name, u.badge_number 
      FROM logs l 
      LEFT JOIN users u ON l.user_id = u.id 
      WHERE 1=1
    `;
    const params = [];
    let paramIndex = 1;

    if (action) {
      query += ` AND l.action = $${paramIndex}`;
      params.push(action);
      paramIndex++;
    }

    if (user_id) {
      query += ` AND l.user_id = $${paramIndex}`;
      params.push(parseInt(user_id));
      paramIndex++;
    }

    query += ` ORDER BY l.created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(parseInt(limit), parseInt(offset));

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error("❌ Erreur Logs:", err);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

// ============================================================================
// GESTION DES GRADES
// ============================================================================
router.get("/grades", isAuthenticated, async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM grades ORDER BY level ASC");
    res.json(result.rows);
  } catch (err) {
    console.error("❌ Erreur Grades:", err);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

router.put("/grades/:id", isAuthenticated, hasPermission('manage_grades'), async (req, res) => {
  try {
    const { id } = req.params;
    const { name, color, permissions } = req.body;

    // Validation
    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return res.status(400).json({ error: "Nom de grade requis" });
    }

    // Vérification hiérarchique
    const canModify = await canModifyGrade(req.user, id);
    if (!canModify.allowed) {
      return res.status(403).json({ error: canModify.reason });
    }

    // Validation des permissions (doit être un objet)
    if (permissions && typeof permissions !== 'object') {
      return res.status(400).json({ error: "Format de permissions invalide" });
    }

    await pool.query(
      "UPDATE grades SET name = $1, color = $2, permissions = $3, updated_at = CURRENT_TIMESTAMP WHERE id = $4",
      [name.trim(), color || '#3b82f6', JSON.stringify(permissions || {}), id]
    );

    await logAction(req.user.id, "UPDATE_GRADE", `Modification grade ID ${id} (${name})`, 'grade', id, req);
    
    res.json({ success: true, message: "Grade mis à jour" });
  } catch (err) {
    console.error("❌ Erreur Update Grade:", err);
    res.status(500).json({ error: "Erreur mise à jour grade" });
  }
});

// ============================================================================
// GESTION DES UTILISATEURS
// ============================================================================

// Liste complète (admin)
router.get("/users", isAuthenticated, hasPermission('manage_users'), async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        u.id, u.username, u.first_name, u.last_name, u.badge_number, 
        u.phone, u.grade_id, u.visible_grade_id, u.is_active, u.is_admin,
        u.created_at, u.profile_picture,
        g.name as grade_name, g.level as grade_level, g.color as grade_color,
        vg.name as visible_grade_name
      FROM users u 
      LEFT JOIN grades g ON u.grade_id = g.id 
      LEFT JOIN grades vg ON u.visible_grade_id = vg.id
      ORDER BY g.level DESC, u.last_name ASC
    `);
    res.json(result.rows);
  } catch (err) {
    console.error("❌ Erreur Liste Users:", err);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

// Création utilisateur
router.post("/users", isAuthenticated, hasPermission('manage_users'), async (req, res) => {
  try {
    const { username, password, first_name, last_name, badge_number, grade_id, visible_grade_id } = req.body;

    // Validations
    if (!username || !password || !first_name || !last_name || !grade_id) {
      return res.status(400).json({ 
        error: "Champs requis manquants",
        required: ["username", "password", "first_name", "last_name", "grade_id"]
      });
    }

    if (password.length < 4) {
      return res.status(400).json({ error: "Mot de passe trop court (min 4 caractères)" });
    }

    // Vérification hiérarchique sur le grade à attribuer
    const canAssign = await canAssignGrade(req.user, grade_id);
    if (!canAssign.allowed) {
      return res.status(403).json({ error: canAssign.reason });
    }

    // Vérification hiérarchique sur le grade visible (si spécifié)
    if (visible_grade_id) {
      const canAssignVisible = await canAssignGrade(req.user, visible_grade_id);
      if (!canAssignVisible.allowed) {
        return res.status(403).json({ error: "Grade visible: " + canAssignVisible.reason });
      }
    }

    // Vérifier unicité username
    const existingUser = await pool.query("SELECT id FROM users WHERE username = $1", [username.toLowerCase()]);
    if (existingUser.rows.length > 0) {
      return res.status(400).json({ error: "Ce matricule/identifiant existe déjà" });
    }

    // Création
    const hashedPassword = await bcrypt.hash(password, 12);
    const visGrade = visible_grade_id && visible_grade_id !== "" ? visible_grade_id : null;

    const result = await pool.query(
      `INSERT INTO users (username, password, first_name, last_name, badge_number, grade_id, visible_grade_id, is_active) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, TRUE) RETURNING id`,
      [username.toLowerCase(), hashedPassword, first_name.trim(), last_name.trim(), badge_number || null, grade_id, visGrade]
    );

    await logAction(req.user.id, "CREATE_USER", `Création officier ${first_name} ${last_name} (ID: ${result.rows[0].id})`, 'user', result.rows[0].id, req);

    res.status(201).json({ success: true, id: result.rows[0].id, message: "Utilisateur créé" });
  } catch (err) {
    console.error("❌ Erreur Création User:", err);
    res.status(500).json({ error: "Erreur création utilisateur" });
  }
});

// Modification utilisateur
router.put("/users/:id", isAuthenticated, hasPermission('manage_users'), async (req, res) => {
  try {
    const targetId = parseInt(req.params.id);
    const { first_name, last_name, badge_number, phone, grade_id, visible_grade_id, password, is_active } = req.body;

    // Vérification que la cible existe
    const targetUser = await pool.query("SELECT * FROM users WHERE id = $1", [targetId]);
    if (targetUser.rows.length === 0) {
      return res.status(404).json({ error: "Utilisateur introuvable" });
    }

    // Vérification hiérarchique
    const canAct = await canActOnUser(req.user, targetId);
    if (!canAct.allowed && req.user.id !== targetId) {
      return res.status(403).json({ error: canAct.reason });
    }

    // Si changement de grade, vérifier la hiérarchie
    if (grade_id && grade_id !== targetUser.rows[0].grade_id) {
      const canAssign = await canAssignGrade(req.user, grade_id);
      if (!canAssign.allowed) {
        return res.status(403).json({ error: canAssign.reason });
      }
    }

    // Si changement de grade visible, vérifier la hiérarchie
    if (visible_grade_id && visible_grade_id !== targetUser.rows[0].visible_grade_id) {
      const canAssignVisible = await canAssignGrade(req.user, visible_grade_id);
      if (!canAssignVisible.allowed) {
        return res.status(403).json({ error: "Grade visible: " + canAssignVisible.reason });
      }
    }

    // Construction de la requête dynamique
    const updates = [];
    const params = [];
    let paramIndex = 1;

    if (first_name !== undefined) {
      updates.push(`first_name = $${paramIndex}`);
      params.push(first_name.trim());
      paramIndex++;
    }
    if (last_name !== undefined) {
      updates.push(`last_name = $${paramIndex}`);
      params.push(last_name.trim());
      paramIndex++;
    }
    if (badge_number !== undefined) {
      updates.push(`badge_number = $${paramIndex}`);
      params.push(badge_number);
      paramIndex++;
    }
    if (phone !== undefined) {
      updates.push(`phone = $${paramIndex}`);
      params.push(phone);
      paramIndex++;
    }
    if (grade_id !== undefined) {
      updates.push(`grade_id = $${paramIndex}`);
      params.push(grade_id);
      paramIndex++;
    }
    if (visible_grade_id !== undefined) {
      updates.push(`visible_grade_id = $${paramIndex}`);
      params.push(visible_grade_id === "" ? null : visible_grade_id);
      paramIndex++;
    }
    if (is_active !== undefined) {
      updates.push(`is_active = $${paramIndex}`);
      params.push(is_active);
      paramIndex++;
    }
    if (password && password.trim() !== "") {
      if (password.length < 4) {
        return res.status(400).json({ error: "Mot de passe trop court" });
      }
      const hashedPassword = await bcrypt.hash(password, 12);
      updates.push(`password = $${paramIndex}`);
      params.push(hashedPassword);
      paramIndex++;
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: "Aucune modification fournie" });
    }

    updates.push("updated_at = CURRENT_TIMESTAMP");
    params.push(targetId);

    await pool.query(
      `UPDATE users SET ${updates.join(", ")} WHERE id = $${paramIndex}`,
      params
    );

    await logAction(req.user.id, "UPDATE_USER", `Modification utilisateur ID ${targetId}`, 'user', targetId, req);

    res.json({ success: true, message: "Utilisateur mis à jour" });
  } catch (err) {
    console.error("❌ Erreur Update User:", err);
    res.status(500).json({ error: "Erreur mise à jour utilisateur" });
  }
});

// Suppression utilisateur
router.delete("/users/:id", isAuthenticated, hasPermission('delete_users'), async (req, res) => {
  try {
    const targetId = parseInt(req.params.id);

    // Vérification hiérarchique (inclut la vérification auto-suppression)
    const canAct = await canActOnUser(req.user, targetId);
    if (!canAct.allowed) {
      return res.status(403).json({ error: canAct.reason });
    }

    // Récupérer les infos avant suppression pour le log
    const targetUser = await pool.query(
      "SELECT first_name, last_name, username FROM users WHERE id = $1", 
      [targetId]
    );
    
    if (targetUser.rows.length === 0) {
      return res.status(404).json({ error: "Utilisateur introuvable" });
    }

    const { first_name, last_name, username } = targetUser.rows[0];

    // Nettoyage des références
    await pool.query("UPDATE appointments SET assigned_medic_id = NULL WHERE assigned_medic_id = $1", [targetId]);
    await pool.query("UPDATE appointments SET completed_by_id = NULL WHERE completed_by_id = $1", [targetId]);
    await pool.query("UPDATE patients SET created_by = NULL WHERE created_by = $1", [targetId]);
    
    // Note: On garde les logs pour l'audit (user_id sera NULL après suppression grâce à ON DELETE SET NULL)

    // Suppression
    await pool.query("DELETE FROM users WHERE id = $1", [targetId]);

    await logAction(req.user.id, "DELETE_USER", `Suppression utilisateur ${first_name} ${last_name} (${username}, ID: ${targetId})`, 'user', targetId, req);

    res.json({ success: true, message: "Utilisateur supprimé" });
  } catch (err) {
    console.error("❌ Erreur Delete User:", err);
    res.status(500).json({ error: "Erreur suppression utilisateur" });
  }
});

module.exports = router;
