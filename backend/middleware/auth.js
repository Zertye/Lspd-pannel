const jwt = require("jsonwebtoken");
const pool = require("../config/database");

const JWT_SECRET = process.env.JWT_SECRET || "lspd-secret";

// ============================================================================
// SYSTÈME DE PERMISSIONS LSPD - VERSION SÉCURISÉE
// ============================================================================

/**
 * Liste exhaustive des permissions du système
 * Toute nouvelle permission doit être ajoutée ici
 */
const PERMISSIONS = {
  ACCESS_DASHBOARD: "access_dashboard",
  VIEW_ROSTER: "view_roster",
  MANAGE_APPOINTMENTS: "manage_appointments",    // Assigner, clôturer, refuser
  DELETE_APPOINTMENTS: "delete_appointments",    // Supprimer définitivement
  MANAGE_USERS: "manage_users",                  // Créer/modifier utilisateurs
  DELETE_USERS: "delete_users",                  // Supprimer utilisateurs
  MANAGE_GRADES: "manage_grades",                // Modifier grades & permissions
  VIEW_LOGS: "view_logs",                        // Accès aux logs système
  FORCE_END_SERVICE: "force_end_service",        // Forcer fin de service d'un officier
};

/**
 * Récupère les informations complètes d'un utilisateur avec ses permissions
 */
const getFullUser = async (userId) => {
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
};

/**
 * Middleware: Extrait l'utilisateur du token JWT ou de la session
 */
const extractUser = async (req, res, next) => {
  try {
    // 1. Essayer le token JWT (Header Authorization)
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith("Bearer ")) {
      const token = authHeader.substring(7);
      try {
        const decoded = jwt.verify(token, JWT_SECRET);
        const user = await getFullUser(decoded.id);
        if (user && user.is_active) {
          req.user = user;
          return next();
        }
      } catch (e) {
        // Token invalide, on continue pour essayer la session
      }
    }

    // 2. Essayer la session Passport
    if (req.isAuthenticated && req.isAuthenticated() && req.user) {
      // Rafraîchir les données utilisateur pour avoir les permissions à jour
      const freshUser = await getFullUser(req.user.id);
      if (freshUser && freshUser.is_active) {
        req.user = freshUser;
        return next();
      }
    }

    // Aucune authentification trouvée
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
 * Le niveau 99 (Dev) a TOUTES les permissions automatiquement
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
 * Usage: hasPermission('manage_users')
 */
const hasPermission = (permKey) => (req, res, next) => {
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
 * Usage: hasAllPermissions(['manage_users', 'delete_users'])
 */
const hasAllPermissions = (permKeys) => (req, res, next) => {
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

  const missingPerms = permKeys.filter(p => !userHasPermission(req.user, p));
  
  if (missingPerms.length === 0) {
    return next();
  }

  return res.status(403).json({ 
    error: `Permissions manquantes: ${missingPerms.join(', ')}`,
    code: "PERMISSION_DENIED",
    required: permKeys,
    missing: missingPerms
  });
};

/**
 * Middleware: Vérifie au moins une permission parmi plusieurs
 * Usage: hasAnyPermission(['manage_users', 'view_logs'])
 */
const hasAnyPermission = (permKeys) => (req, res, next) => {
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

  const hasAny = permKeys.some(p => userHasPermission(req.user, p));
  
  if (hasAny) {
    return next();
  }

  return res.status(403).json({ 
    error: `Une permission requise parmi: ${permKeys.join(', ')}`,
    code: "PERMISSION_DENIED",
    required: permKeys
  });
};

/**
 * Vérifie si l'utilisateur courant peut agir sur un utilisateur cible
 * Règle: On ne peut jamais agir sur quelqu'un de niveau >= au sien
 * Exception: Niveau 99 peut tout faire
 */
const canActOnUser = async (actorUser, targetUserId) => {
  if (!actorUser) return { allowed: false, reason: "Non authentifié" };
  
  // On ne peut pas agir sur soi-même (pour delete notamment)
  if (actorUser.id === parseInt(targetUserId)) {
    return { allowed: false, reason: "Action sur soi-même interdite" };
  }
  
  // Niveau 99 peut tout faire
  if (actorUser.grade_level === 99) {
    return { allowed: true };
  }

  // Récupérer le niveau de la cible
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
    return { 
      allowed: false, 
      reason: "Vous ne pouvez pas agir sur un officier de rang supérieur ou égal" 
    };
  }

  return { allowed: true };
};

/**
 * Vérifie si l'utilisateur peut attribuer un grade spécifique
 * Règle: On ne peut pas attribuer un grade >= au sien
 * Exception: Niveau 99 peut tout faire
 */
const canAssignGrade = async (actorUser, gradeId) => {
  if (!actorUser) return { allowed: false, reason: "Non authentifié" };
  
  // Niveau 99 peut tout faire
  if (actorUser.grade_level === 99) {
    return { allowed: true };
  }

  // Récupérer le niveau du grade à attribuer
  const gradeResult = await pool.query(
    "SELECT level FROM grades WHERE id = $1", 
    [gradeId]
  );

  if (gradeResult.rows.length === 0) {
    return { allowed: false, reason: "Grade introuvable" };
  }

  const gradeLevel = gradeResult.rows[0].level;

  if (gradeLevel >= actorUser.grade_level) {
    return { 
      allowed: false, 
      reason: "Vous ne pouvez pas attribuer un grade supérieur ou égal au vôtre" 
    };
  }

  return { allowed: true };
};

/**
 * Vérifie si l'utilisateur peut modifier un grade
 * Règle: On ne peut pas modifier un grade >= au sien
 * Exception: Niveau 99 peut tout faire
 */
const canModifyGrade = async (actorUser, gradeId) => {
  if (!actorUser) return { allowed: false, reason: "Non authentifié" };
  
  // Niveau 99 peut tout faire
  if (actorUser.grade_level === 99) {
    return { allowed: true };
  }

  // Récupérer le niveau du grade à modifier
  const gradeResult = await pool.query(
    "SELECT level FROM grades WHERE id = $1", 
    [gradeId]
  );

  if (gradeResult.rows.length === 0) {
    return { allowed: false, reason: "Grade introuvable" };
  }

  const gradeLevel = gradeResult.rows[0].level;

  if (gradeLevel >= actorUser.grade_level) {
    return { 
      allowed: false, 
      reason: "Vous ne pouvez pas modifier un grade supérieur ou égal au vôtre" 
    };
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
