const express = require("express");
const router = express.Router();
const pool = require("../config/database");
const { isAuthenticated, hasPermission } = require("../middleware/auth");
const logAction = require("../utils/logger");

// 1. Dépôt de plainte (Public)
router.post("/public", async (req, res) => {
  try {
    const { patient_name, patient_phone, patient_discord, appointment_type, description } = req.body;
    
    const result = await pool.query(
      "INSERT INTO appointments (patient_name, patient_phone, patient_discord, appointment_type, description, status) VALUES ($1,$2,$3,$4,$5, 'pending') RETURNING *",
      [patient_name, patient_phone, patient_discord, appointment_type, description]
    );

    // --- NOTIFICATION DISCORD LSPD ---
    try {
        const webhookUrl = process.env.DISCORD_WEBHOOK_URL || ""; 
        
        if (webhookUrl) {
            await fetch(webhookUrl, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    embeds: [{
                        title: "👮 Nouvelle Plainte Déposée",
                        color: 3899894, // Bleu Police (#3b82f6)
                        fields: [
                            { name: "Plaignant", value: patient_name, inline: true },
                            { name: "Contact", value: patient_phone || "N/A", inline: true },
                            { name: "Motif", value: appointment_type, inline: false },
                            { name: "Détails", value: description || "Aucun détail", inline: false }
                        ],
                        footer: { text: "LSPD Intranet System" },
                        timestamp: new Date().toISOString()
                    }]
                })
            });
        }
    } catch (e) { console.error("Webhook Error:", e); }

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

// 2. Liste des plaintes (Interne)
router.get("/", isAuthenticated, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT a.*, u.first_name as medic_first_name, u.last_name as medic_last_name 
      FROM appointments a 
      LEFT JOIN users u ON a.assigned_medic_id = u.id 
      ORDER BY CASE WHEN status='pending' THEN 1 WHEN status='assigned' THEN 2 ELSE 3 END, created_at DESC
    `);
    
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: "Erreur serveur" });
  }
});

// 3. Actions sur les plaintes (Status update)
router.post("/:id/:action", isAuthenticated, hasPermission('manage_appointments'), async (req, res) => {
    const { action } = req.params;
    const id = req.params.id;
    let status = 'pending';
    let logMsg = "";

    if (action === 'assign') { status = 'assigned'; logMsg = "Prise en charge plainte"; }
    if (action === 'complete') { status = 'completed'; logMsg = "Plainte clôturée"; }
    if (action === 'cancel') { status = 'cancelled'; logMsg = "Plainte refusée"; }

    if (action === 'assign') {
        await pool.query("UPDATE appointments SET status=$1, assigned_medic_id=$2 WHERE id=$3", [status, req.user.id, id]);
    } else {
        await pool.query("UPDATE appointments SET status=$1 WHERE id=$2", [status, id]);
    }

    await logAction(req.user.id, "UPDATE_COMPLAINT", `${logMsg} ID ${id}`, id);
    res.json({ success: true });
});

// 4. SUPPRIMER DÉFINITIVEMENT UNE PLAINTE
router.delete("/:id", isAuthenticated, hasPermission('manage_appointments'), async (req, res) => {
    try {
        const { id } = req.params;
        await pool.query("DELETE FROM appointments WHERE id = $1", [id]);
        
        await logAction(req.user.id, "DELETE_COMPLAINT", `Suppression définitive plainte ID ${id}`, id);
        res.json({ success: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Erreur serveur lors de la suppression" });
    }
});

module.exports = router;
