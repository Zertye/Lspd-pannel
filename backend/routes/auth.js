const express = require(“express”);
const bcrypt = require(“bcrypt”);
const jwt = require(“jsonwebtoken”);
const pool = require(”../config/database”);
const { getFullUser } = require(”../middleware/auth”);
const logAction = require(”../utils/logger”);

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || “lspd-secret”;
const JWT_EXPIRY = process.env.JWT_EXPIRY || “7d”;

// ============================================================================
// CONNEXION
// ============================================================================
router.post(”/login”, async (req, res) => {
try {
const { username, password } = req.body;

```
// Validation
if (!username || !password) {
  return res.status(400).json({ error: "Identifiant et mot de passe requis" });
}

// Debug: Log la tentative de connexion
console.log(`🔐 Tentative de connexion: "${username}"`);

// Recherche utilisateur (insensible à la casse, trim des espaces)
const cleanUsername = username.trim().toLowerCase();

const result = await pool.query(
  "SELECT * FROM users WHERE LOWER(TRIM(username)) = $1", 
  [cleanUsername]
);

// Debug: Log le résultat
console.log(`   → Utilisateurs trouvés: ${result.rows.length}`);

if (result.rows.length === 0) {
  // Log tentative échouée (pas d'ID utilisateur car inconnu)
  await logAction(null, "LOGIN_FAILED", `Tentative connexion échouée - Identifiant inconnu: ${username}`, 'auth', null, req);
  return res.status(401).json({ error: "Identifiant inconnu" });
}

const user = result.rows[0];
console.log(`   → Utilisateur trouvé: ${user.first_name} ${user.last_name} (ID: ${user.id})`);

// Vérification mot de passe
const passwordValid = await bcrypt.compare(password, user.password);
if (!passwordValid) {
  await logAction(user.id, "LOGIN_FAILED", "Tentative connexion échouée - Mot de passe incorrect", 'auth', user.id, req);
  return res.status(401).json({ error: "Mot de passe incorrect" });
}

// Vérification compte actif
if (!user.is_active) {
  await logAction(user.id, "LOGIN_FAILED", "Tentative connexion échouée - Compte désactivé", 'auth', user.id, req);
  return res.status(401).json({ error: "Compte suspendu" });
}

// Génération token JWT
const token = jwt.sign(
  { id: user.id, username: user.username },
  JWT_SECRET,
  { expiresIn: JWT_EXPIRY }
);

// Récupération données complètes
const fullUser = await getFullUser(user.id);

// Log connexion réussie
await logAction(user.id, "LOGIN_SUCCESS", "Connexion réussie", 'auth', user.id, req);
console.log(`   ✅ Connexion réussie pour ${user.username}`);

// Support session Passport (optionnel) - avec vérification de session
if (req.logIn && req.session) {
  // Patch pour Passport 0.6+ avec express-session
  if (!req.session.regenerate) {
    req.session.regenerate = (cb) => cb();
  }
  if (!req.session.save) {
    req.session.save = (cb) => cb();
  }
  req.logIn(user, (err) => {
    if (err) console.error("⚠️ Passport session error:", err);
  });
}

res.json({
  success: true,
  token,
  user: fullUser
});
```

} catch (err) {
console.error(“❌ Erreur Login:”, err);
res.status(500).json({ error: “Erreur serveur” });
}
});

// ============================================================================
// RÉCUPÉRATION UTILISATEUR COURANT
// ============================================================================
router.get(”/me”, async (req, res) => {
try {
let userId = null;

```
// 1. Essayer depuis req.user (déjà extrait par middleware)
if (req.user?.id) {
  userId = req.user.id;
}

// 2. Essayer depuis le header Authorization
if (!userId && req.headers.authorization) {
  const authHeader = req.headers.authorization;
  if (authHeader.startsWith("Bearer ")) {
    try {
      const token = authHeader.substring(7);
      const decoded = jwt.verify(token, JWT_SECRET);
      userId = decoded.id;
    } catch (e) {
      return res.status(401).json({ error: "Token invalide ou expiré" });
    }
  }
}

if (!userId) {
  return res.status(401).json({ error: "Non connecté" });
}

const user = await getFullUser(userId);

if (!user) {
  return res.status(401).json({ error: "Utilisateur introuvable" });
}

if (!user.is_active) {
  return res.status(401).json({ error: "Compte désactivé" });
}

res.json({ user });
```

} catch (err) {
console.error(“❌ Erreur /me:”, err);
res.status(500).json({ error: “Erreur serveur” });
}
});

// ============================================================================
// DÉCONNEXION
// ============================================================================
router.post(”/logout”, async (req, res) => {
try {
// Log de déconnexion si on a un utilisateur
if (req.user?.id) {
await logAction(req.user.id, “LOGOUT”, “Déconnexion”, ‘auth’, req.user.id, req);
}

```
// Destruction session Passport
if (req.logout) {
  req.logout((err) => {
    if (err) console.error("⚠️ Logout error:", err);
  });
}

if (req.session?.destroy) {
  req.session.destroy((err) => {
    if (err) console.error("⚠️ Session destroy error:", err);
  });
}

res.json({ success: true, message: "Déconnexion réussie" });
```

} catch (err) {
console.error(“❌ Erreur Logout:”, err);
res.status(500).json({ error: “Erreur serveur” });
}
});

// ============================================================================
// VÉRIFICATION TOKEN (utilitaire)
// ============================================================================
router.get(”/verify”, async (req, res) => {
try {
const authHeader = req.headers.authorization;

```
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
```

} catch (err) {
if (err.name === ‘TokenExpiredError’) {
return res.status(401).json({ valid: false, error: “Token expiré” });
}
if (err.name === ‘JsonWebTokenError’) {
return res.status(401).json({ valid: false, error: “Token invalide” });
}
res.status(500).json({ valid: false, error: “Erreur serveur” });
}
});

// ============================================================================
// DEBUG: Liste des utilisateurs (à supprimer en prod)
// ============================================================================
router.get(”/debug/users”, async (req, res) => {
try {
const result = await pool.query(
“SELECT id, username, first_name, last_name, is_active FROM users ORDER BY id”
);
res.json({
count: result.rows.length,
users: result.rows.map(u => ({
id: u.id,
username: u.username,
name: `${u.first_name} ${u.last_name}`,
active: u.is_active
}))
});
} catch (err) {
console.error(“❌ Erreur debug/users:”, err);
res.status(500).json({ error: “Erreur serveur” });
}
});

module.exports = router;
