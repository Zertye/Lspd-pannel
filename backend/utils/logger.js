const pool = require("../config/database");

const logAction = async (userId, action, details, targetId = null) => {
  try {
    await pool.query(
      "INSERT INTO logs (user_id, action, details, target_id) VALUES ($1, $2, $3, $4)",
      [userId, action, details, targetId]
    );
  } catch (err) {
    console.error("❌ Logger Error:", err);
  }
};

module.exports = logAction;
