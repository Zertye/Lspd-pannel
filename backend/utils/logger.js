const pool = require("../config/database");

/**
 * Enregistre une action dans les logs d'audit
 * 
 * @param {number} userId - ID de l'utilisateur effectuant l'action
 * @param {string} action - Type d'action (CREATE_USER, DELETE_APPOINTMENT, etc.)
 * @param {string} details - Description détaillée de l'action
 * @param {string} targetType - Type de la cible (user, appointment, grade, etc.)
 * @param {number} targetId - ID de l'élément ciblé
 * @param {object} req - Objet requête Express (pour IP et User-Agent)
 */
const logAction = async (userId, action, details, targetType = null, targetId = null, req = null) => {
  try {
    // Extraction des métadonnées de la requête
    let ipAddress = null;
    let userAgent = null;

    if (req) {
      // Récupération de l'IP (en tenant compte des proxies)
      ipAddress = req.headers['x-forwarded-for']?.split(',')[0]?.trim() 
                  || req.headers['x-real-ip'] 
                  || req.connection?.remoteAddress 
                  || req.socket?.remoteAddress 
                  || null;
      
      userAgent = req.headers['user-agent'] || null;
    }

    await pool.query(
      `INSERT INTO logs (user_id, action, details, target_type, target_id, ip_address, user_agent) 
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [userId, action, details, targetType, targetId, ipAddress, userAgent]
    );
  } catch (err) {
    // On log l'erreur mais on ne fait pas échouer l'opération principale
    console.error("❌ Logger Error:", err.message);
  }
};

/**
 * Actions standards pour référence
 */
const LOG_ACTIONS = {
  // Utilisateurs
  CREATE_USER: 'CREATE_USER',
  UPDATE_USER: 'UPDATE_USER',
  DELETE_USER: 'DELETE_USER',
  
  // Grades
  UPDATE_GRADE: 'UPDATE_GRADE',
  
  // Plaintes/Appointments
  UPDATE_APPOINTMENT: 'UPDATE_APPOINTMENT',
  DELETE_APPOINTMENT: 'DELETE_APPOINTMENT',
  
  // Auth
  LOGIN_SUCCESS: 'LOGIN_SUCCESS',
  LOGIN_FAILED: 'LOGIN_FAILED',
  LOGOUT: 'LOGOUT',
  
  // Profil
  UPDATE_PROFILE: 'UPDATE_PROFILE',
};

module.exports = logAction;
module.exports.LOG_ACTIONS = LOG_ACTIONS;
