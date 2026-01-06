const express = require("express");
const router = express.Router();
const pool = require("../config/database");
const { isAuthenticated, hasPermission, userHasPermission } = require("../middleware/auth");
const logAction = require("../utils/logger");

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Vérifie si l'utilisateur peut gérer la centrale
 * (Plus haut gradé en service OU opérateur centrale désigné)
 */
const canManageCentrale = async (userId) => {
  // Vérifier si c'est un opérateur centrale actif
  const operatorCheck = await pool.query(
    "SELECT id FROM centrale_operators WHERE user_id = $1 AND is_active = TRUE",
    [userId]
  );
  if (operatorCheck.rows.length > 0) return true;

  // Vérifier si c'est le plus haut gradé en service
  const highestOnDuty = await pool.query(`
    SELECT s.user_id, g.level
    FROM services s
    JOIN users u ON s.user_id = u.id
    JOIN grades g ON u.grade_id = g.id
    WHERE s.is_active = TRUE AND s.end_time IS NULL
    ORDER BY g.level DESC
    LIMIT 1
  `);

  if (highestOnDuty.rows.length > 0 && highestOnDuty.rows[0].user_id === userId) {
    return true;
  }

  return false;
};

/**
 * Middleware pour vérifier les droits de gestion centrale
 */
const checkCentraleAccess = async (req, res, next) => {
  try {
    const canManage = await canManageCentrale(req.user.id);
    
    // Niveau 99 (Dev) peut toujours gérer
    if (req.user.grade_level === 99) {
      req.canManageCentrale = true;
      return next();
    }
    
    req.canManageCentrale = canManage;
    next();
  } catch (err) {
    console.error("❌ Erreur checkCentraleAccess:", err);
    next();
  }
};

// ============================================================================
// SERVICES (Prise/Fin de service)
// ============================================================================

// Statut de service de l'utilisateur courant
router.get("/service/status", isAuthenticated, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT s.*, 
        EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - s.start_time))::INTEGER as current_duration
      FROM services s 
      WHERE s.user_id = $1 AND s.is_active = TRUE AND s.end_time IS NULL
      ORDER BY s.start_time DESC LIMIT 1
    `, [req.user.id]);

    const isOnDuty = result.rows.length > 0;
    
    // Vérifier si l'utilisateur est dans une patrouille
    let patrol = null;
    if (isOnDuty) {
      const patrolResult = await pool.query(`
        SELECT p.*, pm.role,
          (SELECT json_agg(json_build_object(
            'id', u.id, 'first_name', u.first_name, 'last_name', u.last_name,
            'badge_number', u.badge_number, 'role', pm2.role,
            'grade_name', COALESCE(vg.name, g.name), 'grade_color', COALESCE(vg.color, g.color)
          )) FROM patrol_members pm2 
          JOIN users u ON pm2.user_id = u.id
          LEFT JOIN grades g ON u.grade_id = g.id
          LEFT JOIN grades vg ON u.visible_grade_id = vg.id
          WHERE pm2.patrol_id = p.id) as members
        FROM patrol_members pm
        JOIN patrols p ON pm.patrol_id = p.id
        WHERE pm.user_id = $1
      `, [req.user.id]);
      
      if (patrolResult.rows.length > 0) {
        patrol = patrolResult.rows[0];
      }
    }

    // Vérifier si l'utilisateur est opérateur centrale
    const operatorCheck = await pool.query(
      "SELECT id FROM centrale_operators WHERE user_id = $1 AND is_active = TRUE",
      [req.user.id]
    );

    res.json({
      isOnDuty,
      service: isOnDuty ? result.rows[0] : null,
      patrol,
      isOperator: operatorCheck.rows.length > 0,
      canManageCentrale: await canManageCentrale(req.user.id)
    });
  } catch (err) {
    console.error("❌ Erreur Service Status:", err);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

// Prendre son service
router.post("/service/start", isAuthenticated, async (req, res) => {
  try {
    // Vérifier s'il n'est pas déjà en service
    const existing = await pool.query(
      "SELECT id FROM services WHERE user_id = $1 AND is_active = TRUE AND end_time IS NULL",
      [req.user.id]
    );

    if (existing.rows.length > 0) {
      return res.status(400).json({ error: "Vous êtes déjà en service" });
    }

    const result = await pool.query(
      "INSERT INTO services (user_id) VALUES ($1) RETURNING *",
      [req.user.id]
    );

    await logAction(req.user.id, "SERVICE_START", "Prise de service", 'service', result.rows[0].id, req);

    res.json({ success: true, service: result.rows[0] });
  } catch (err) {
    console.error("❌ Erreur Service Start:", err);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

// Fin de service
router.post("/service/end", isAuthenticated, async (req, res) => {
  try {
    // Récupérer le service actif
    const service = await pool.query(
      "SELECT * FROM services WHERE user_id = $1 AND is_active = TRUE AND end_time IS NULL",
      [req.user.id]
    );

    if (service.rows.length === 0) {
      return res.status(400).json({ error: "Vous n'êtes pas en service" });
    }

    const serviceId = service.rows[0].id;
    const startTime = new Date(service.rows[0].start_time);
    const endTime = new Date();
    const duration = Math.floor((endTime - startTime) / 1000); // en secondes

    // Retirer l'utilisateur de sa patrouille s'il en a une
    await pool.query("DELETE FROM patrol_members WHERE user_id = $1", [req.user.id]);

    // Retirer le statut d'opérateur centrale
    await pool.query(
      "UPDATE centrale_operators SET is_active = FALSE WHERE user_id = $1",
      [req.user.id]
    );

    // Mettre à jour le service
    await pool.query(
      `UPDATE services SET end_time = CURRENT_TIMESTAMP, total_duration = $1, is_active = FALSE WHERE id = $2`,
      [duration, serviceId]
    );

    // Mettre à jour le temps total de patrouille de l'utilisateur
    await pool.query(
      "UPDATE users SET total_patrol_time = COALESCE(total_patrol_time, 0) + $1 WHERE id = $2",
      [duration, req.user.id]
    );

    await logAction(req.user.id, "SERVICE_END", `Fin de service (${Math.floor(duration / 60)} minutes)`, 'service', serviceId, req);

    res.json({ success: true, duration });
  } catch (err) {
    console.error("❌ Erreur Service End:", err);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

// Forcer la fin de service d'un officier
router.post("/service/force-end", isAuthenticated, async (req, res) => {
  try {
    const { userId } = req.body;

    // Vérifier la permission
    const canForce = userHasPermission(req.user, 'force_end_service');
    if (!canForce && req.user.grade_level !== 99) {
      return res.status(403).json({ error: "Permission refusée" });
    }

    // Vérifier que l'officier est bien en service
    const service = await pool.query(
      "SELECT * FROM services WHERE user_id = $1 AND is_active = TRUE AND end_time IS NULL",
      [userId]
    );

    if (service.rows.length === 0) {
      return res.status(400).json({ error: "Cet officier n'est pas en service" });
    }

    const serviceId = service.rows[0].id;
    const startTime = new Date(service.rows[0].start_time);
    const endTime = new Date();
    const duration = Math.floor((endTime - startTime) / 1000);

    // Retirer l'utilisateur de sa patrouille
    await pool.query("DELETE FROM patrol_members WHERE user_id = $1", [userId]);

    // Retirer le statut d'opérateur centrale
    await pool.query(
      "UPDATE centrale_operators SET is_active = FALSE WHERE user_id = $1",
      [userId]
    );

    // Mettre à jour le service
    await pool.query(
      `UPDATE services SET end_time = CURRENT_TIMESTAMP, total_duration = $1, is_active = FALSE WHERE id = $2`,
      [duration, serviceId]
    );

    // Mettre à jour le temps total de patrouille
    await pool.query(
      "UPDATE users SET total_patrol_time = COALESCE(total_patrol_time, 0) + $1 WHERE id = $2",
      [duration, userId]
    );

    // Récupérer le nom de l'officier pour le log
    const officerInfo = await pool.query("SELECT first_name, last_name FROM users WHERE id = $1", [userId]);
    const officerName = officerInfo.rows[0] ? `${officerInfo.rows[0].first_name} ${officerInfo.rows[0].last_name}` : `ID ${userId}`;

    await logAction(req.user.id, "FORCE_SERVICE_END", `Fin de service forcée pour ${officerName}`, 'service', serviceId, req);

    res.json({ success: true, duration });
  } catch (err) {
    console.error("❌ Erreur Force Service End:", err);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

// Liste des officiers en service
router.get("/service/online", isAuthenticated, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        u.id, u.first_name, u.last_name, u.badge_number, u.profile_picture,
        COALESCE(vg.name, g.name) as grade_name,
        COALESCE(vg.color, g.color) as grade_color,
        g.level as grade_level,
        s.start_time,
        EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - s.start_time))::INTEGER as duration,
        (SELECT p.id FROM patrol_members pm JOIN patrols p ON pm.patrol_id = p.id WHERE pm.user_id = u.id LIMIT 1) as patrol_id,
        (SELECT p.name FROM patrol_members pm JOIN patrols p ON pm.patrol_id = p.id WHERE pm.user_id = u.id LIMIT 1) as patrol_name,
        (SELECT p.call_sign FROM patrol_members pm JOIN patrols p ON pm.patrol_id = p.id WHERE pm.user_id = u.id LIMIT 1) as patrol_call_sign,
        (SELECT pm.role FROM patrol_members pm WHERE pm.user_id = u.id LIMIT 1) as patrol_role,
        (EXISTS(SELECT 1 FROM centrale_operators co WHERE co.user_id = u.id AND co.is_active = TRUE)) as is_operator
      FROM services s
      JOIN users u ON s.user_id = u.id
      LEFT JOIN grades g ON u.grade_id = g.id
      LEFT JOIN grades vg ON u.visible_grade_id = vg.id
      WHERE s.is_active = TRUE AND s.end_time IS NULL
      ORDER BY g.level DESC, s.start_time ASC
    `);

    // Identifier le plus haut gradé
    let highestGradeUserId = null;
    if (result.rows.length > 0) {
      highestGradeUserId = result.rows[0].id;
    }

    res.json({
      officers: result.rows,
      highestGradeUserId,
      totalOnline: result.rows.length
    });
  } catch (err) {
    console.error("❌ Erreur Service Online:", err);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

// ============================================================================
// OPÉRATEUR CENTRALE
// ============================================================================

// Désigner un opérateur centrale
router.post("/operator/assign", isAuthenticated, checkCentraleAccess, async (req, res) => {
  try {
    if (!req.canManageCentrale && req.user.grade_level !== 99) {
      return res.status(403).json({ error: "Vous n'avez pas les droits pour cette action" });
    }

    const { userId } = req.body;

    // Vérifier que l'utilisateur est en service
    const onDuty = await pool.query(
      "SELECT id FROM services WHERE user_id = $1 AND is_active = TRUE AND end_time IS NULL",
      [userId]
    );

    if (onDuty.rows.length === 0) {
      return res.status(400).json({ error: "Cet officier n'est pas en service" });
    }

    // Désactiver l'ancien opérateur
    await pool.query("UPDATE centrale_operators SET is_active = FALSE WHERE is_active = TRUE");

    // Créer ou activer le nouvel opérateur
    await pool.query(`
      INSERT INTO centrale_operators (user_id, assigned_by, is_active)
      VALUES ($1, $2, TRUE)
      ON CONFLICT (user_id) 
      DO UPDATE SET assigned_by = $2, assigned_at = CURRENT_TIMESTAMP, is_active = TRUE
    `, [userId, req.user.id]);

    // Récupérer les infos de l'opérateur
    const operator = await pool.query(`
      SELECT u.id, u.first_name, u.last_name, u.badge_number,
        COALESCE(vg.name, g.name) as grade_name
      FROM users u
      LEFT JOIN grades g ON u.grade_id = g.id
      LEFT JOIN grades vg ON u.visible_grade_id = vg.id
      WHERE u.id = $1
    `, [userId]);

    await logAction(req.user.id, "ASSIGN_OPERATOR", `Désignation opérateur centrale: ${operator.rows[0].first_name} ${operator.rows[0].last_name}`, 'centrale', userId, req);

    res.json({ success: true, operator: operator.rows[0] });
  } catch (err) {
    console.error("❌ Erreur Assign Operator:", err);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

// Retirer le statut d'opérateur
router.post("/operator/remove", isAuthenticated, checkCentraleAccess, async (req, res) => {
  try {
    if (!req.canManageCentrale && req.user.grade_level !== 99) {
      return res.status(403).json({ error: "Vous n'avez pas les droits pour cette action" });
    }

    const { userId } = req.body;

    await pool.query(
      "UPDATE centrale_operators SET is_active = FALSE WHERE user_id = $1",
      [userId]
    );

    await logAction(req.user.id, "REMOVE_OPERATOR", `Retrait opérateur centrale ID ${userId}`, 'centrale', userId, req);

    res.json({ success: true });
  } catch (err) {
    console.error("❌ Erreur Remove Operator:", err);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

// Opérateur actuel
router.get("/operator/current", isAuthenticated, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT co.*, u.first_name, u.last_name, u.badge_number,
        COALESCE(vg.name, g.name) as grade_name,
        COALESCE(vg.color, g.color) as grade_color,
        ab.first_name as assigned_by_first_name, ab.last_name as assigned_by_last_name
      FROM centrale_operators co
      JOIN users u ON co.user_id = u.id
      LEFT JOIN grades g ON u.grade_id = g.id
      LEFT JOIN grades vg ON u.visible_grade_id = vg.id
      LEFT JOIN users ab ON co.assigned_by = ab.id
      WHERE co.is_active = TRUE
      LIMIT 1
    `);

    res.json({ operator: result.rows[0] || null });
  } catch (err) {
    console.error("❌ Erreur Current Operator:", err);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

// ============================================================================
// PATROUILLES
// ============================================================================

// Liste des patrouilles actives
router.get("/patrols", isAuthenticated, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT p.*,
        (SELECT json_agg(json_build_object(
          'id', u.id, 'first_name', u.first_name, 'last_name', u.last_name,
          'badge_number', u.badge_number, 'role', pm.role, 'profile_picture', u.profile_picture,
          'grade_name', COALESCE(vg.name, g.name), 'grade_color', COALESCE(vg.color, g.color),
          'grade_level', g.level
        ) ORDER BY pm.role DESC, g.level DESC) 
        FROM patrol_members pm 
        JOIN users u ON pm.user_id = u.id
        LEFT JOIN grades g ON u.grade_id = g.id
        LEFT JOIN grades vg ON u.visible_grade_id = vg.id
        WHERE pm.patrol_id = p.id) as members,
        (SELECT COUNT(*) FROM patrol_members WHERE patrol_id = p.id) as member_count,
        cu.first_name as created_by_first_name, cu.last_name as created_by_last_name
      FROM patrols p
      LEFT JOIN users cu ON p.created_by = cu.id
      ORDER BY p.priority DESC, p.created_at DESC
    `);

    res.json(result.rows);
  } catch (err) {
    console.error("❌ Erreur Patrols List:", err);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

// Créer une patrouille
router.post("/patrols", isAuthenticated, checkCentraleAccess, async (req, res) => {
  try {
    if (!req.canManageCentrale && req.user.grade_level !== 99) {
      return res.status(403).json({ error: "Vous n'avez pas les droits pour créer une patrouille" });
    }

    const { name, call_sign, vehicle, sector, notes } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ error: "Nom de la patrouille requis" });
    }

    const result = await pool.query(`
      INSERT INTO patrols (name, call_sign, vehicle, sector, notes, created_by)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `, [name.trim(), call_sign || null, vehicle || null, sector || null, notes || null, req.user.id]);

    await logAction(req.user.id, "CREATE_PATROL", `Création patrouille "${name}"`, 'patrol', result.rows[0].id, req);

    res.status(201).json({ success: true, patrol: result.rows[0] });
  } catch (err) {
    console.error("❌ Erreur Create Patrol:", err);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

// Modifier une patrouille
router.put("/patrols/:id", isAuthenticated, checkCentraleAccess, async (req, res) => {
  try {
    if (!req.canManageCentrale && req.user.grade_level !== 99) {
      return res.status(403).json({ error: "Vous n'avez pas les droits pour modifier une patrouille" });
    }

    const { id } = req.params;
    const { name, call_sign, vehicle, sector, status, priority, notes } = req.body;

    const updates = [];
    const params = [];
    let idx = 1;

    if (name !== undefined) { updates.push(`name = $${idx}`); params.push(name.trim()); idx++; }
    if (call_sign !== undefined) { updates.push(`call_sign = $${idx}`); params.push(call_sign); idx++; }
    if (vehicle !== undefined) { updates.push(`vehicle = $${idx}`); params.push(vehicle); idx++; }
    if (sector !== undefined) { updates.push(`sector = $${idx}`); params.push(sector); idx++; }
    if (status !== undefined) { updates.push(`status = $${idx}`); params.push(status); idx++; }
    if (priority !== undefined) { updates.push(`priority = $${idx}`); params.push(priority); idx++; }
    if (notes !== undefined) { updates.push(`notes = $${idx}`); params.push(notes); idx++; }

    if (updates.length === 0) {
      return res.status(400).json({ error: "Aucune modification fournie" });
    }

    updates.push("updated_at = CURRENT_TIMESTAMP");
    params.push(id);

    await pool.query(
      `UPDATE patrols SET ${updates.join(", ")} WHERE id = $${idx}`,
      params
    );

    await logAction(req.user.id, "UPDATE_PATROL", `Modification patrouille ID ${id}`, 'patrol', parseInt(id), req);

    res.json({ success: true });
  } catch (err) {
    console.error("❌ Erreur Update Patrol:", err);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

// Supprimer une patrouille
router.delete("/patrols/:id", isAuthenticated, checkCentraleAccess, async (req, res) => {
  try {
    if (!req.canManageCentrale && req.user.grade_level !== 99) {
      return res.status(403).json({ error: "Vous n'avez pas les droits pour supprimer une patrouille" });
    }

    const { id } = req.params;

    // Récupérer info pour le log
    const patrol = await pool.query("SELECT name FROM patrols WHERE id = $1", [id]);

    await pool.query("DELETE FROM patrols WHERE id = $1", [id]);

    await logAction(req.user.id, "DELETE_PATROL", `Suppression patrouille "${patrol.rows[0]?.name}"`, 'patrol', parseInt(id), req);

    res.json({ success: true });
  } catch (err) {
    console.error("❌ Erreur Delete Patrol:", err);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

// Assigner un officier à une patrouille
router.post("/patrols/:id/assign", isAuthenticated, checkCentraleAccess, async (req, res) => {
  try {
    if (!req.canManageCentrale && req.user.grade_level !== 99) {
      return res.status(403).json({ error: "Vous n'avez pas les droits pour cette action" });
    }

    const { id } = req.params;
    const { userId, role = 'member' } = req.body;

    // Vérifier que l'officier est en service
    const onDuty = await pool.query(
      "SELECT id FROM services WHERE user_id = $1 AND is_active = TRUE AND end_time IS NULL",
      [userId]
    );

    if (onDuty.rows.length === 0) {
      return res.status(400).json({ error: "Cet officier n'est pas en service" });
    }

    // Retirer l'officier de son ancienne patrouille
    await pool.query("DELETE FROM patrol_members WHERE user_id = $1", [userId]);

    // Ajouter à la nouvelle patrouille
    await pool.query(
      "INSERT INTO patrol_members (patrol_id, user_id, role) VALUES ($1, $2, $3)",
      [id, userId, role]
    );

    // Récupérer info pour le log
    const user = await pool.query("SELECT first_name, last_name FROM users WHERE id = $1", [userId]);
    const patrol = await pool.query("SELECT name FROM patrols WHERE id = $1", [id]);

    await logAction(req.user.id, "ASSIGN_PATROL", `Assignation ${user.rows[0].first_name} ${user.rows[0].last_name} à "${patrol.rows[0].name}"`, 'patrol', parseInt(id), req);

    res.json({ success: true });
  } catch (err) {
    console.error("❌ Erreur Assign Patrol:", err);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

// Retirer un officier d'une patrouille
router.post("/patrols/:id/unassign", isAuthenticated, checkCentraleAccess, async (req, res) => {
  try {
    if (!req.canManageCentrale && req.user.grade_level !== 99) {
      return res.status(403).json({ error: "Vous n'avez pas les droits pour cette action" });
    }

    const { id } = req.params;
    const { userId } = req.body;

    await pool.query(
      "DELETE FROM patrol_members WHERE patrol_id = $1 AND user_id = $2",
      [id, userId]
    );

    await logAction(req.user.id, "UNASSIGN_PATROL", `Retrait d'un officier de la patrouille ID ${id}`, 'patrol', parseInt(id), req);

    res.json({ success: true });
  } catch (err) {
    console.error("❌ Erreur Unassign Patrol:", err);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

// Changer le chef de patrouille
router.post("/patrols/:id/leader", isAuthenticated, checkCentraleAccess, async (req, res) => {
  try {
    if (!req.canManageCentrale && req.user.grade_level !== 99) {
      return res.status(403).json({ error: "Vous n'avez pas les droits pour cette action" });
    }

    const { id } = req.params;
    const { userId } = req.body;

    // Retirer le leader actuel
    await pool.query(
      "UPDATE patrol_members SET role = 'member' WHERE patrol_id = $1 AND role = 'leader'",
      [id]
    );

    // Définir le nouveau leader
    await pool.query(
      "UPDATE patrol_members SET role = 'leader' WHERE patrol_id = $1 AND user_id = $2",
      [id, userId]
    );

    res.json({ success: true });
  } catch (err) {
    console.error("❌ Erreur Set Leader:", err);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

// ============================================================================
// NOTES DE CENTRALE
// ============================================================================

// Liste des notes (globales ou par patrouille)
router.get("/notes", isAuthenticated, async (req, res) => {
  try {
    const { patrol_id, limit = 50 } = req.query;

    let query = `
      SELECT cn.*, 
        u.first_name as author_first_name, u.last_name as author_last_name, u.badge_number as author_badge,
        p.name as patrol_name, p.call_sign as patrol_call_sign
      FROM centrale_notes cn
      LEFT JOIN users u ON cn.author_id = u.id
      LEFT JOIN patrols p ON cn.patrol_id = p.id
    `;

    const params = [];
    if (patrol_id) {
      query += " WHERE cn.patrol_id = $1";
      params.push(patrol_id);
    }

    query += " ORDER BY cn.is_pinned DESC, cn.created_at DESC LIMIT $" + (params.length + 1);
    params.push(parseInt(limit));

    const result = await pool.query(query, params);

    res.json(result.rows);
  } catch (err) {
    console.error("❌ Erreur Notes List:", err);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

// Créer une note
router.post("/notes", isAuthenticated, checkCentraleAccess, async (req, res) => {
  try {
    if (!req.canManageCentrale && req.user.grade_level !== 99) {
      return res.status(403).json({ error: "Vous n'avez pas les droits pour créer une note" });
    }

    const { content, patrol_id, note_type = 'info', is_pinned = false } = req.body;

    if (!content || !content.trim()) {
      return res.status(400).json({ error: "Contenu de la note requis" });
    }

    const result = await pool.query(`
      INSERT INTO centrale_notes (author_id, patrol_id, content, note_type, is_pinned)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `, [req.user.id, patrol_id || null, content.trim(), note_type, is_pinned]);

    res.status(201).json({ success: true, note: result.rows[0] });
  } catch (err) {
    console.error("❌ Erreur Create Note:", err);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

// Supprimer une note
router.delete("/notes/:id", isAuthenticated, checkCentraleAccess, async (req, res) => {
  try {
    if (!req.canManageCentrale && req.user.grade_level !== 99) {
      return res.status(403).json({ error: "Vous n'avez pas les droits pour supprimer une note" });
    }

    const { id } = req.params;
    await pool.query("DELETE FROM centrale_notes WHERE id = $1", [id]);

    res.json({ success: true });
  } catch (err) {
    console.error("❌ Erreur Delete Note:", err);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

// Toggle pin note
router.post("/notes/:id/pin", isAuthenticated, checkCentraleAccess, async (req, res) => {
  try {
    if (!req.canManageCentrale && req.user.grade_level !== 99) {
      return res.status(403).json({ error: "Vous n'avez pas les droits" });
    }

    const { id } = req.params;
    await pool.query(
      "UPDATE centrale_notes SET is_pinned = NOT is_pinned WHERE id = $1",
      [id]
    );

    res.json({ success: true });
  } catch (err) {
    console.error("❌ Erreur Pin Note:", err);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

// ============================================================================
// DISPATCH / APPELS
// ============================================================================

// Liste des appels
router.get("/dispatch", isAuthenticated, async (req, res) => {
  try {
    const { status, limit = 50 } = req.query;

    let query = `
      SELECT dc.*, 
        p.name as patrol_name, p.call_sign as patrol_call_sign,
        u.first_name as dispatched_by_first_name, u.last_name as dispatched_by_last_name
      FROM dispatch_calls dc
      LEFT JOIN patrols p ON dc.patrol_id = p.id
      LEFT JOIN users u ON dc.dispatched_by = u.id
    `;

    const params = [];
    if (status) {
      query += " WHERE dc.status = $1";
      params.push(status);
    }

    query += " ORDER BY dc.priority DESC, dc.created_at DESC LIMIT $" + (params.length + 1);
    params.push(parseInt(limit));

    const result = await pool.query(query, params);

    res.json(result.rows);
  } catch (err) {
    console.error("❌ Erreur Dispatch List:", err);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

// Créer un appel
router.post("/dispatch", isAuthenticated, checkCentraleAccess, async (req, res) => {
  try {
    if (!req.canManageCentrale && req.user.grade_level !== 99) {
      return res.status(403).json({ error: "Vous n'avez pas les droits pour créer un appel" });
    }

    const { call_type, location, description, priority = 0, patrol_id } = req.body;

    if (!call_type) {
      return res.status(400).json({ error: "Type d'appel requis" });
    }

    const result = await pool.query(`
      INSERT INTO dispatch_calls (call_type, location, description, priority, patrol_id, dispatched_by, dispatched_at, status)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
    `, [
      call_type, 
      location || null, 
      description || null, 
      priority, 
      patrol_id || null,
      patrol_id ? req.user.id : null,
      patrol_id ? new Date() : null,
      patrol_id ? 'dispatched' : 'pending'
    ]);

    await logAction(req.user.id, "CREATE_DISPATCH", `Création appel "${call_type}" à ${location || 'N/A'}`, 'dispatch', result.rows[0].id, req);

    res.status(201).json({ success: true, dispatch: result.rows[0] });
  } catch (err) {
    console.error("❌ Erreur Create Dispatch:", err);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

// Assigner un appel à une patrouille
router.post("/dispatch/:id/assign", isAuthenticated, checkCentraleAccess, async (req, res) => {
  try {
    if (!req.canManageCentrale && req.user.grade_level !== 99) {
      return res.status(403).json({ error: "Vous n'avez pas les droits" });
    }

    const { id } = req.params;
    const { patrol_id } = req.body;

    await pool.query(`
      UPDATE dispatch_calls 
      SET patrol_id = $1, dispatched_by = $2, dispatched_at = CURRENT_TIMESTAMP, status = 'dispatched'
      WHERE id = $3
    `, [patrol_id, req.user.id, id]);

    res.json({ success: true });
  } catch (err) {
    console.error("❌ Erreur Assign Dispatch:", err);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

// Changer le statut d'un appel
router.post("/dispatch/:id/status", isAuthenticated, async (req, res) => {
  try {
    const { id } = req.params;
    const { status, completion_notes } = req.body;

    const validStatuses = ['pending', 'dispatched', 'en_route', 'on_scene', 'completed', 'cancelled'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: "Statut invalide" });
    }

    const updates = ["status = $1"];
    const params = [status];

    if (status === 'completed' || status === 'cancelled') {
      updates.push("completed_at = CURRENT_TIMESTAMP");
      if (completion_notes) {
        updates.push("completion_notes = $2");
        params.push(completion_notes);
      }
    }

    params.push(id);
    await pool.query(
      `UPDATE dispatch_calls SET ${updates.join(", ")} WHERE id = $${params.length}`,
      params
    );

    res.json({ success: true });
  } catch (err) {
    console.error("❌ Erreur Status Dispatch:", err);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

// ============================================================================
// STATISTIQUES CENTRALE
// ============================================================================

router.get("/stats", isAuthenticated, async (req, res) => {
  try {
    const [onlineCount, patrolsCount, pendingCalls, todayServices] = await Promise.all([
      pool.query("SELECT COUNT(*) FROM services WHERE is_active = TRUE AND end_time IS NULL"),
      pool.query("SELECT COUNT(*) FROM patrols"),
      pool.query("SELECT COUNT(*) FROM dispatch_calls WHERE status IN ('pending', 'dispatched', 'en_route', 'on_scene')"),
      pool.query(`
        SELECT COUNT(*) FROM services 
        WHERE DATE(start_time) = CURRENT_DATE
      `)
    ]);

    res.json({
      officersOnline: parseInt(onlineCount.rows[0].count),
      activePatrols: parseInt(patrolsCount.rows[0].count),
      pendingCalls: parseInt(pendingCalls.rows[0].count),
      todayServices: parseInt(todayServices.rows[0].count)
    });
  } catch (err) {
    console.error("❌ Erreur Centrale Stats:", err);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

// Temps de patrouille des utilisateurs (pour Dashboard)
router.get("/patrol-times", isAuthenticated, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        u.id, u.first_name, u.last_name, u.badge_number,
        COALESCE(vg.name, g.name) as grade_name,
        COALESCE(vg.color, g.color) as grade_color,
        u.total_patrol_time,
        (SELECT SUM(COALESCE(total_duration, 0)) + 
          COALESCE(
            (SELECT EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - start_time))::INTEGER 
             FROM services WHERE user_id = u.id AND is_active = TRUE AND end_time IS NULL LIMIT 1),
            0
          )
         FROM services WHERE user_id = u.id) as calculated_time,
        (SELECT COUNT(*) FROM services WHERE user_id = u.id) as total_services
      FROM users u
      LEFT JOIN grades g ON u.grade_id = g.id
      LEFT JOIN grades vg ON u.visible_grade_id = vg.id
      WHERE u.is_active = TRUE
      ORDER BY u.total_patrol_time DESC NULLS LAST
      LIMIT 20
    `);

    res.json(result.rows);
  } catch (err) {
    console.error("❌ Erreur Patrol Times:", err);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

module.exports = router;
