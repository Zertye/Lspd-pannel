const express = require("express");
const router = express.Router();
const pool = require("../config/database");
const { isAuthenticated, hasPermission } = require("../middleware/auth");
const logAction = require("../utils/logger");

// 1. Dépôt de plainte (Public)
router.post("/public", async (req, res) => {
  try {
    const { patient_name, patient_phone, patient_discord, appointment_type, description } = req.body;
    
    // appointment_type = Type de délit (Vol, Agression...)
    // description = Faits
    
    const result = await pool.query(
      "INSERT INTO appointments (patient_name, patient_phone, patient_discord, appointment_type, description, status) VALUES ($1,$2,$3,$4,$5, 'pending') RETURNING *",
      [patient_name, patient_phone, patient_discord, appointment_type, description]
    );

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

// 3. Actions sur les plaintes
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

module.exports = router;
