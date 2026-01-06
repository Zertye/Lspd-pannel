const express = require("express");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const pool = require("../config/database");
const { getFullUser } = require("../middleware/auth");
const logAction = require("../utils/logger");

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || "lspd-secret";
const JWT_EXPIRY = process.env.JWT_EXPIRY || "7d";

// --- LOGIN ---
router.post("/login", async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: "Identifiant et mot de passe requis" });
    }

    console.log("[AUTH] Tentative de connexion:", username);

    const cleanUsername = username.trim().toLowerCase();
    
    const result = await pool.query(
      "SELECT * FROM users WHERE LOWER(TRIM(username)) = $1", 
      [cleanUsername]
    );

    console.log("[AUTH] Utilisateurs trouves:", result.rows.length);

    if (result.rows.length === 0) {
      await logAction(null, "LOGIN_FAILED", "Identifiant inconnu: " + username, "auth", null, req);
      return res.status(401).json({ error: "Identifiant inconnu" });
    }

    const user = result.rows[0];
    console.log("[AUTH] Utilisateur:", user.first_name, user.last_name);

    const passwordValid = await bcrypt.compare(password, user.password);
    if (!passwordValid) {
      await logAction(user.id, "LOGIN_FAILED", "Mot de passe incorrect", "auth", user.id, req);
      return res.status(401).json({ error: "Mot de passe incorrect" });
    }

    if (!user.is_active) {
      await logAction(user.id, "LOGIN_FAILED", "Compte desactive", "auth", user.id, req);
      return res.status(401).json({ error: "Compte suspendu" });
    }

    const token = jwt.sign(
      { id: user.id, username: user.username },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRY }
    );

    const fullUser = await getFullUser(user.id);

    await logAction(user.id, "LOGIN_SUCCESS", "Connexion reussie", "auth", user.id, req);
    console.log("[AUTH] Connexion OK pour", user.username);

    // Gestion de la session (si Passport/Express-session est utilisé)
    if (req.logIn && req.session) {
      if (!req.session.regenerate) {
        req.session.regenerate = (cb) => cb();
      }
      if (!req.session.save) {
        req.session.save = (cb) => cb();
      }
      req.logIn(user, (err) => {
        if (err) console.error("[AUTH] Passport error:", err);
      });
    }

    res.json({
      success: true,
      token,
      user: fullUser
    });
  } catch (err) {
    console.error("[AUTH] Erreur Login:", err);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

// --- ME (Get current user) ---
router.get("/me", async (req, res) => {
  try {
    let userId = null;

    if (req.user && req.user.id) {
      userId = req.user.id;
    }

    if (!userId && req.headers.authorization) {
      const authHeader = req.headers.authorization;
      if (authHeader.startsWith("Bearer ")) {
        try {
          const token = authHeader.substring(7);
          const decoded = jwt.verify(token, JWT_SECRET);
          userId = decoded.id;
        } catch (e) {
          return res.status(401).json({ error: "Token invalide ou expire" });
        }
      }
    }

    if (!userId) {
      return res.status(401).json({ error: "Non connecte" });
    }

    const user = await getFullUser(userId);
    
    if (!user) {
      return res.status(401).json({ error: "Utilisateur introuvable" });
    }

    if (!user.is_active) {
      return res.status(401).json({ error: "Compte desactive" });
    }

    res.json({ user });
  } catch (err) {
    console.error("[AUTH] Erreur /me:", err);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

// --- LOGOUT ---
router.post("/logout", async (req, res) => {
  try {
    if (req.user && req.user.id) {
      await logAction(req.user.id, "LOGOUT", "Deconnexion", "auth", req.user.id, req);
    }

    if (req.logout) {
      req.logout((err) => {
        if (err) console.error("[AUTH] Logout error:", err);
      });
    }

    if (req.session && req.session.destroy) {
      req.session.destroy((err) => {
        if (err) console.error("[AUTH] Session destroy error:", err);
      });
    }

    res.json({ success: true, message: "Deconnexion reussie" });
  } catch (err) {
    console.error("[AUTH] Erreur Logout:", err);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

// --- VERIFY TOKEN ---
router.get("/verify", async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
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
    if (err.name === "TokenExpiredError") {
      return res.status(401).json({ valid: false, error: "Token expire" });
    }
    if (err.name === "JsonWebTokenError") {
      return res.status(401).json({ valid: false, error: "Token invalide" });
    }
    res.status(500).json({ valid: false, error: "Erreur serveur" });
  }
});

// --- DEBUG ---
router.get("/debug/users", async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT id, username, first_name, last_name, is_active FROM users ORDER BY id"
    );
    res.json({
      count: result.rows.length,
      users: result.rows.map(u => ({
        id: u.id,
        username: u.username,
        name: u.first_name + " " + u.last_name,
        active: u.is_active
      }))
    });
  } catch (err) {
    console.error("[AUTH] Erreur debug/users:", err);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

module.exports = router;
