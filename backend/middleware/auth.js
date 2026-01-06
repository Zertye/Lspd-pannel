const jwt = require("jsonwebtoken");
const pool = require("../config/database");

// ============================================================================
// SÉCURITÉ: JWT_SECRET OBLIGATOIRE
// ============================================================================
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  console.error("❌ FATAL: JWT_SECRET non défini dans les variables d'environnement!");
  console.error("   Définissez JWT_SECRET avant de démarrer le serveur.");
  process.exit(1);
}

// ============================================================================
// SYSTÈME DE PERMISSIONS LSPD - VERSION SÉCURISÉE
// ============================================================================

const PERMISSIONS = {
  ACCESS_DASHBOARD: "access_dashboard",
  VIEW_ROSTER: "view_roster",
  MANAGE_APPOINTMENTS: "manage_appointments",
  DELETE_APPOINTMENTS: "delete_appointments",
  MANAGE_USERS: "manage_users",
  DELETE_USERS: "delete_users",
  MANAGE_GRADES: "manage_grades",
  VIEW_LOGS: "view_logs",
  FORCE_END_SERVICE: "force_end_service",
};

/**
 * Récupère les informations complètes d'un utilisateur avec ses permissions
 */
const getFullUser = async (userId) => {
  try {
    const result = await pool.query(`
      SELECT 
        u.id, 
        u.username, 
        u.first_name, 
        u.last_name, 
        u.badge_number, 
        u.phone,
        u.is_admin, 
        u.is_active,
        u.profile_picture,
        u.grade_id,
        u.visible_grade_id,
        u.total_patrol_time,
        COALESCE(vg.name, g.name) as grade_name,
        COALESCE(vg.color, g.color) as grade_color,
        g.level as grade_level,
        g.permissions as grade_permissions
      FROM users u
      LEFT JOIN grades g ON u.grade_id = g.id
      LEFT JOIN grades vg ON u.visible_grade_id = vg.id
      WHERE u.id = $1
    `, [userId]);
    return result.rows[0] || null;
  } catch (err) {
    console.error("❌ Erreur getFullUser:", err);
    return null;
  }
};

/**
 * Middleware: Extrait l'utilisateur du token JWT UNIQUEMENT
 */
const extractUser = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith("Bearer ")) {
      const token = authHeader.substring(7);
      try {
        const decoded = jwt.verify(token, JWT_SECRET);
        const user = await getFullUser(decoded.id);
        if (user && user.is_active) {
          req.user = user;
        }
      } catch (e) {
        // Token invalide ou expiré, on continue sans user
        if (e.name === 'TokenExpiredError') {
          // Token expiré - le client devra se reconnecter
        }
      }
    }
    next();
  } catch (err) {
    console.error("❌ Erreur extractUser:", err);
    next();
  }
};

/**
 * Middleware: Vérifie que l'utilisateur est authentifié
 */
const isAuthenticated = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ 
      error: "Non authentifié",
      code: "AUTH_REQUIRED"
    });
  }
  
  if (!req.user.is_active) {
    return res.status(403).json({ 
      error: "Compte désactivé",
      code: "ACCOUNT_DISABLED"
    });
  }
  
  return next();
};

/**
 * Vérifie si un utilisateur possède une permission spécifique
 */
const userHasPermission = (user, permKey) => {
  if (!user) return false;
  
  // Niveau 99 (Dev) = Super Admin, toutes permissions
  if (user.grade_level === 99) return true;
  
  // Flag is_admin = toutes permissions (backup admin)
  if (user.is_admin === true) return true;
  
  // Vérification dans les permissions du grade
  const perms = user.grade_permissions || {};
  return perms[permKey] === true;
};

/**
 * Middleware: Vérifie une permission spécifique
 */
const hasPermission = (permKey) => (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ error: "Non authentifié", code: "AUTH_REQUIRED" });
  }

  if (!req.user.is_active) {
    return res.status(403).json({ error: "Compte désactivé", code: "ACCOUNT_DISABLED" });
  }

  if (userHasPermission(req.user, permKey)) {
    return next();
  }

  return res.status(403).json({ 
    error: `Permission requise: ${permKey}`,
    code: "PERMISSION_DENIED",
    required: permKey
  });
};

/**
 * Middleware: Vérifie plusieurs permissions (toutes requises)
 */
const hasAllPermissions = (permKeys) => (req, res, next) => {
  if (!req.user) return res.status(401).json({ error: "Non authentifié" });
  if (!req.user.is_active) return res.status(403).json({ error: "Compte désactivé" });

  const missingPerms = permKeys.filter(p => !userHasPermission(req.user, p));
  
  if (missingPerms.length === 0) return next();

  return res.status(403).json({ 
    error: `Permissions manquantes: ${missingPerms.join(', ')}`,
    code: "PERMISSION_DENIED"
  });
};

/**
 * Middleware: Vérifie au moins une permission parmi plusieurs
 */
const hasAnyPermission = (permKeys) => (req, res, next) => {
  if (!req.user) return res.status(401).json({ error: "Non authentifié" });
  if (!req.user.is_active) return res.status(403).json({ error: "Compte désactivé" });

  const hasAny = permKeys.some(p => userHasPermission(req.user, p));
  
  if (hasAny) return next();

  return res.status(403).json({ 
    error: `Une permission requise parmi: ${permKeys.join(', ')}`,
    code: "PERMISSION_DENIED"
  });
};

/**
 * Vérifie si l'utilisateur courant peut agir sur un utilisateur cible
 */
const canActOnUser = async (actorUser, targetUserId) => {
  if (!actorUser) return { allowed: false, reason: "Non authentifié" };
  
  if (actorUser.id === parseInt(targetUserId)) {
    return { allowed: false, reason: "Action sur soi-même interdite" };
  }
  
  if (actorUser.grade_level === 99) return { allowed: true };

  const targetResult = await pool.query(`
    SELECT u.id, g.level as grade_level 
    FROM users u 
    LEFT JOIN grades g ON u.grade_id = g.id 
    WHERE u.id = $1
  `, [targetUserId]);

  if (targetResult.rows.length === 0) {
    return { allowed: false, reason: "Utilisateur cible introuvable" };
  }

  const targetLevel = targetResult.rows[0].grade_level || 0;

  if (targetLevel >= actorUser.grade_level) {
    return { allowed: false, reason: "Vous ne pouvez pas agir sur un officier de rang supérieur ou égal" };
  }

  return { allowed: true };
};

/**
 * Vérifie si l'utilisateur peut attribuer un grade spécifique
 */
const canAssignGrade = async (actorUser, gradeId) => {
  if (!actorUser) return { allowed: false, reason: "Non authentifié" };
  if (actorUser.grade_level === 99) return { allowed: true };

  const gradeResult = await pool.query("SELECT level FROM grades WHERE id = $1", [gradeId]);

  if (gradeResult.rows.length === 0) return { allowed: false, reason: "Grade introuvable" };

  const gradeLevel = gradeResult.rows[0].level;

  if (gradeLevel >= actorUser.grade_level) {
    return { allowed: false, reason: "Vous ne pouvez pas attribuer un grade supérieur ou égal au vôtre" };
  }

  return { allowed: true };
};

/**
 * Vérifie si l'utilisateur peut modifier un grade
 */
const canModifyGrade = async (actorUser, gradeId) => {
  if (!actorUser) return { allowed: false, reason: "Non authentifié" };
  if (actorUser.grade_level === 99) return { allowed: true };

  const gradeResult = await pool.query("SELECT level FROM grades WHERE id = $1", [gradeId]);

  if (gradeResult.rows.length === 0) return { allowed: false, reason: "Grade introuvable" };

  const gradeLevel = gradeResult.rows[0].level;

  if (gradeLevel >= actorUser.grade_level) {
    return { allowed: false, reason: "Vous ne pouvez pas modifier un grade supérieur ou égal au vôtre" };
  }

  return { allowed: true };
};

module.exports = { 
  extractUser, 
  isAuthenticated, 
  hasPermission,
  hasAllPermissions,
  hasAnyPermission,
  userHasPermission,
  canActOnUser,
  canAssignGrade,
  canModifyGrade,
  getFullUser,
  PERMISSIONS
};
