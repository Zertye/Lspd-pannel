const express = require("express");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const pool = require("../config/database");
const { getFullUser } = require("../middleware/auth");
const logAction = require("../utils/logger");

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || "lspd-secret";
const JWT_EXPIRY = process.env.JWT_EXPIRY || "7d";

// LOGIN
router.post("/login", async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) return res.status(400).json({ error: "Identifiant et mot de passe requis" });

    const result = await pool.query("SELECT * FROM users WHERE LOWER(username) = LOWER($1)", [username]);

    if (result.rows.length === 0) {
      await logAction(null, "LOGIN_FAILED", `Matricule inconnu: ${username}`, 'auth', null, req);
      return res.status(401).json({ error: "Identifiants incorrects" });
    }

    const user = result.rows[0];
    const passwordValid = await bcrypt.compare(password, user.password);
    
    if (!passwordValid) {
      await logAction(user.id, "LOGIN_FAILED", "Mot de passe incorrect", 'auth', user.id, req);
      return res.status(401).json({ error: "Identifiants incorrects" });
    }

    if (!user.is_active) {
      return res.status(401).json({ error: "Compte suspendu" });
    }

    // Génération Token
    const token = jwt.sign(
      { id: user.id, username: user.username },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRY }
    );

    const fullUser = await getFullUser(user.id);
    await logAction(user.id, "LOGIN_SUCCESS", "Connexion réussie", 'auth', user.id, req);

    // SUPPRIMÉ: Tout le bloc req.logIn / req.session

    res.json({ success: true, token, user: fullUser });

  } catch (err) {
    console.error("❌ Erreur Login:", err);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

// ME (Reste quasiment identique, nettoyage mineur)
router.get("/me", async (req, res) => {
  try {
    // Si extractUser a fait son travail, req.user est déjà là
    if (!req.user) {
      return res.status(401).json({ error: "Non connecté" });
    }
    res.json({ user: req.user });
  } catch (err) {
    console.error("❌ Erreur /me:", err);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

// LOGOUT (Simplifié : le serveur dit juste "OK", c'est le front qui jette le token)
router.post("/logout", async (req, res) => {
  try {
    if (req.user?.id) {
      await logAction(req.user.id, "LOGOUT", "Déconnexion", 'auth', req.user.id, req);
    }
    // Plus de session à détruire côté serveur
    res.json({ success: true, message: "Déconnexion réussie" });
  } catch (err) {
    console.error("❌ Erreur Logout:", err);
    res.json({ success: true });
  }
});

// VERIFY (Inchangé)
router.get("/verify", async (req, res) => {
    // ... (garde le code existant, il est basé sur le token donc compatible)
    // Code identique à ton fichier actuel
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader?.startsWith("Bearer ")) {
          return res.status(401).json({ valid: false, error: "Token manquant" });
        }
        const token = authHeader.substring(7);
        const decoded = jwt.verify(token, JWT_SECRET);
        const user = await getFullUser(decoded.id);
        if (!user || !user.is_active) {
          return res.status(401).json({ valid: false, error: "Utilisateur invalide" });
        }
        res.json({ valid: true, userId: user.id, username: user.username });
    } catch (err) {
        res.status(401).json({ valid: false, error: "Token invalide" });
    }
});

module.exports = router;
