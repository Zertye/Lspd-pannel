const jwt = require("jsonwebtoken");
const pool = require("../config/database");

const JWT_SECRET = process.env.JWT_SECRET || "lspd-secret";

const getFullUser = async (userId) => {
  const result = await pool.query(`
    SELECT u.id, u.username, u.first_name, u.last_name, u.badge_number, u.is_admin, u.profile_picture,
      COALESCE(vg.name, g.name) as grade_name,
      g.level as grade_level,
      g.permissions as grade_permissions
    FROM users u
    LEFT JOIN grades g ON u.grade_id = g.id
    LEFT JOIN grades vg ON u.visible_grade_id = vg.id
    WHERE u.id = $1
  `, [userId]);
  return result.rows[0] || null;
};

const extractUser = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith("Bearer ")) {
      const token = authHeader.substring(7);
      try {
        const decoded = jwt.verify(token, JWT_SECRET);
        const user = await getFullUser(decoded.id);
        if (user) { req.user = user; return next(); }
      } catch (e) {}
    }
    if (req.isAuthenticated && req.isAuthenticated()) return next();
    next();
  } catch (err) { next(); }
};

const isAuthenticated = (req, res, next) => {
  if (req.user) return next();
  res.status(401).json({ error: "Non authentifié" });
};

const isAdmin = (req, res, next) => {
  if (!req.user) return res.status(401).json({ error: "Non authentifié" });
  if (req.user.grade_level === 99 || req.user.is_admin || req.user.grade_level >= 10) return next();
  res.status(403).json({ error: "Accès refusé" });
};

const hasPermission = (permKey) => (req, res, next) => {
  if (!req.user) return res.status(401).json({ error: "Non authentifié" });
  if (req.user.grade_level === 99 || req.user.is_admin) return next();
  const perms = req.user.grade_permissions || {};
  if (perms[permKey] === true) return next();
  res.status(403).json({ error: `Permission manquante: ${permKey}` });
};

module.exports = { extractUser, isAuthenticated, isAdmin, hasPermission };
