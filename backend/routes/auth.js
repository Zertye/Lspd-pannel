const express = require("express");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const pool = require("../config/database");
const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || "lspd-secret";

const getFullUser = async (userId) => {
  // Mise à jour pour supporter le "Grade Visible" (RP) comme dans passport.js
  const result = await pool.query(`
    SELECT 
      u.id, u.username, u.first_name, u.last_name, u.badge_number, u.is_admin, u.profile_picture, u.visible_grade_id,
      -- Si un grade visible est défini, on l'affiche, sinon on affiche le vrai grade
      COALESCE(vg.name, g.name) as grade_name,
      COALESCE(vg.color, g.color) as grade_color,
      -- On garde TOUJOURS le vrai niveau pour les permissions
      g.level as grade_level,
      g.permissions as grade_permissions
    FROM users u 
    LEFT JOIN grades g ON u.grade_id = g.id 
    LEFT JOIN grades vg ON u.visible_grade_id = vg.id
    WHERE u.id = $1
  `, [userId]);
  return result.rows[0];
};

router.post("/login", async (req, res) => {
  try {
    const { username, password } = req.body;
    const result = await pool.query("SELECT * FROM users WHERE username = $1", [username]);
    if (result.rows.length === 0) return res.status(401).json({ error: "Matricule inconnu" });

    const user = result.rows[0];
    if (!(await bcrypt.compare(password, user.password))) return res.status(401).json({ error: "Mot de passe invalide" });
    if (!user.is_active) return res.status(401).json({ error: "Compte suspendu" });

    const token = jwt.sign({ id: user.id }, JWT_SECRET, { expiresIn: "7d" });
    const fullUser = await getFullUser(user.id);

    if (req.logIn) req.logIn(user, () => {});

    res.json({ success: true, token, user: fullUser });
  } catch (err) { res.status(500).json({ error: "Erreur serveur" }); }
});

router.get("/me", async (req, res) => {
  let userId = req.user?.id;
  if (!userId && req.headers.authorization) {
     try { userId = jwt.verify(req.headers.authorization.split(" ")[1], JWT_SECRET).id; } catch {}
  }
  if (!userId) return res.status(401).json({ error: "Non connecté" });
  res.json({ user: await getFullUser(userId) });
});

router.post("/logout", (req, res) => {
  req.logout(() => {});
  res.json({ success: true });
});

module.exports = router;
