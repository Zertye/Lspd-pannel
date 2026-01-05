const express = require("express");
const router = express.Router();
const pool = require("../config/database");
const { isAuthenticated, hasPermission } = require("../middleware/auth");
const logAction = require("../utils/logger");

// ============================================================================
// DÉPÔT DE PLAINTE (PUBLIC - Pas d'authentification requise)
// ============================================================================
router.post("/public", async (req, res) => {
  try {
    const { patient_name, patient_phone, patient_discord, appointment_type, description } = req.body;

    // Validation
    if (!patient_name || !patient_name.trim()) {
      return res.status(400).json({ error: "Nom du plaignant requis" });
    }
    if (!appointment_type) {
      return res.status(400).json({ error: "Type de plainte requis" });
    }

    const result = await pool.query(
      `INSERT INTO appointments (patient_name, patient_phone, patient_discord, appointment_type, description, status) 
       VALUES ($1, $2, $3, $4, $5, 'pending') 
       RETURNING *`,
      [
        patient_name.trim(),
        patient_phone || null,
        patient_discord || null,
        appointment_type,
        description || null
      ]
    );

    // Notification Discord (optionnel)
    try {
      const webhookUrl = process.env.DISCORD_WEBHOOK_URL;
      if (webhookUrl) {
        await fetch(webhookUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            embeds: [{
              title: "👮 Nouvelle Plainte Déposée",
              color: 3899894,
              fields: [
                { name: "Plaignant", value: patient_name, inline: true },
                { name: "Contact", value: patient_phone || "N/A", inline: true },
                { name: "Discord", value: patient_discord || "N/A", inline: true },
                { name: "Motif", value: appointment_type, inline: false },
                { name: "Détails", value: description?.substring(0, 500) || "Aucun détail", inline: false }
              ],
              footer: { text: `Plainte #${result.rows[0].id}` },
              timestamp: new Date().toISOString()
            }]
          })
        });
      }
    } catch (webhookError) {
      console.error("⚠️ Erreur Webhook Discord:", webhookError.message);
    }

    res.status(201).json({ 
      success: true, 
      id: result.rows[0].id,
      message: "Plainte enregistrée avec succès" 
    });
  } catch (err) {
    console.error("❌ Erreur création plainte:", err);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

// ============================================================================
// LISTE DES PLAINTES (Interne - Authentifié)
// ============================================================================
router.get("/", isAuthenticated, hasPermission('access_dashboard'), async (req, res) => {
  try {
    const { status, limit = 100 } = req.query;

    let query = `
      SELECT 
        a.*,
        u1.first_name as medic_first_name, 
        u1.last_name as medic_last_name,
        u1.badge_number as medic_badge,
        u2.first_name as completed_by_first_name,
        u2.last_name as completed_by_last_name
      FROM appointments a 
      LEFT JOIN users u1 ON a.assigned_medic_id = u1.id 
      LEFT JOIN users u2 ON a.completed_by_id = u2.id
    `;

    const params = [];
    if (status) {
      query += " WHERE a.status = $1";
      params.push(status);
    }

    query += ` ORDER BY 
      CASE 
        WHEN a.status = 'pending' THEN 1 
        WHEN a.status = 'assigned' THEN 2 
        ELSE 3 
      END, 
      a.created_at DESC 
      LIMIT $${params.length + 1}`;
    params.push(parseInt(limit));

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error("❌ Erreur liste plaintes:", err);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

// ============================================================================
// DÉTAIL D'UNE PLAINTE
// ============================================================================
router.get("/:id", isAuthenticated, hasPermission('access_dashboard'), async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(`
      SELECT 
        a.*,
        u1.first_name as medic_first_name, 
        u1.last_name as medic_last_name,
        u1.badge_number as medic_badge,
        u2.first_name as completed_by_first_name,
        u2.last_name as completed_by_last_name
      FROM appointments a 
      LEFT JOIN users u1 ON a.assigned_medic_id = u1.id 
      LEFT JOIN users u2 ON a.completed_by_id = u2.id
      WHERE a.id = $1
    `, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Plainte introuvable" });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error("❌ Erreur détail plainte:", err);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

// ============================================================================
// ACTIONS SUR LES PLAINTES (Assigner, Clôturer, Annuler)
// Permission requise: manage_appointments
// ============================================================================
router.post("/:id/:action", isAuthenticated, hasPermission('manage_appointments'), async (req, res) => {
  try {
    const { id, action } = req.params;
    const { completion_notes } = req.body;

    // Vérifier que la plainte existe
    const existing = await pool.query("SELECT * FROM appointments WHERE id = $1", [id]);
    if (existing.rows.length === 0) {
      return res.status(404).json({ error: "Plainte introuvable" });
    }

    const currentStatus = existing.rows[0].status;
    let newStatus;
    let logMessage;
    let updateQuery;
    let updateParams;

    switch (action) {
      case 'assign':
        if (currentStatus !== 'pending') {
          return res.status(400).json({ error: "Cette plainte ne peut plus être assignée" });
        }
        newStatus = 'assigned';
        logMessage = "Prise en charge de la plainte";
        updateQuery = "UPDATE appointments SET status = $1, assigned_medic_id = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3";
        updateParams = [newStatus, req.user.id, id];
        break;

      case 'complete':
        if (currentStatus !== 'assigned') {
          return res.status(400).json({ error: "Cette plainte doit d'abord être assignée" });
        }
        newStatus = 'completed';
        logMessage = "Clôture de la plainte";
        updateQuery = "UPDATE appointments SET status = $1, completed_by_id = $2, completion_notes = $3, updated_at = CURRENT_TIMESTAMP WHERE id = $4";
        updateParams = [newStatus, req.user.id, completion_notes || null, id];
        break;

      case 'cancel':
        if (currentStatus === 'completed') {
          return res.status(400).json({ error: "Impossible d'annuler une plainte déjà clôturée" });
        }
        newStatus = 'cancelled';
        logMessage = "Refus/Annulation de la plainte";
        updateQuery = "UPDATE appointments SET status = $1, completion_notes = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3";
        updateParams = [newStatus, completion_notes || 'Refusée', id];
        break;

      case 'reopen':
        if (currentStatus === 'pending') {
          return res.status(400).json({ error: "Cette plainte est déjà en attente" });
        }
        newStatus = 'pending';
        logMessage = "Réouverture de la plainte";
        updateQuery = "UPDATE appointments SET status = $1, assigned_medic_id = NULL, completed_by_id = NULL, completion_notes = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = $2";
        updateParams = [newStatus, id];
        break;

      default:
        return res.status(400).json({ error: "Action invalide", validActions: ['assign', 'complete', 'cancel', 'reopen'] });
    }

    await pool.query(updateQuery, updateParams);
    await logAction(req.user.id, "UPDATE_APPOINTMENT", `${logMessage} #${id}`, 'appointment', parseInt(id), req);

    res.json({ success: true, newStatus, message: logMessage });
  } catch (err) {
    console.error("❌ Erreur action plainte:", err);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

// ============================================================================
// SUPPRESSION DÉFINITIVE D'UNE PLAINTE
// Permission requise: delete_appointments (séparée de manage_appointments)
// ============================================================================
router.delete("/:id", isAuthenticated, hasPermission('delete_appointments'), async (req, res) => {
  try {
    const { id } = req.params;

    // Récupérer les infos avant suppression pour le log
    const existing = await pool.query(
      "SELECT id, patient_name, appointment_type, status FROM appointments WHERE id = $1", 
      [id]
    );

    if (existing.rows.length === 0) {
      return res.status(404).json({ error: "Plainte introuvable" });
    }

    const { patient_name, appointment_type, status } = existing.rows[0];

    // Suppression définitive
    await pool.query("DELETE FROM appointments WHERE id = $1", [id]);

    await logAction(
      req.user.id, 
      "DELETE_APPOINTMENT", 
      `Suppression définitive plainte #${id} - ${patient_name} (${appointment_type}) - Statut: ${status}`, 
      'appointment', 
      parseInt(id), 
      req
    );

    res.json({ success: true, message: "Plainte supprimée définitivement" });
  } catch (err) {
    console.error("❌ Erreur suppression plainte:", err);
    res.status(500).json({ error: "Erreur serveur lors de la suppression" });
  }
});

module.exports = router;
