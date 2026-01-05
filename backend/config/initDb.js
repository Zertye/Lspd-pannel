const pool = require("./database");
const bcrypt = require("bcrypt");

const initDatabase = async () => {
  const client = await pool.connect();
  try {
    console.log("👮 LSPD Database Check & Init...");

    // 1. CRÉATION DES TABLES
    await client.query(`
      CREATE TABLE IF NOT EXISTS grades (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        category VARCHAR(100),
        level INTEGER DEFAULT 1,
        color VARCHAR(20) DEFAULT '#3b82f6',
        permissions JSONB DEFAULT '{}',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      
      -- Table des plaintes (anciennement appointments)
      CREATE TABLE IF NOT EXISTS appointments (
        id SERIAL PRIMARY KEY, 
        patient_name VARCHAR(200), -- Nom du plaignant
        patient_phone VARCHAR(20), 
        patient_discord VARCHAR(100), 
        appointment_type VARCHAR(50), -- Type de plainte
        preferred_date DATE, -- Date incident/dispo
        preferred_time TIME, 
        description TEXT, 
        status VARCHAR(20) DEFAULT 'pending', 
        assigned_medic_id INTEGER REFERENCES users(id), -- Officier en charge
        completion_notes TEXT, 
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, 
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS session (
        sid VARCHAR NOT NULL PRIMARY KEY, 
        sess JSON NOT NULL, 
        expire TIMESTAMP(6) NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_session_expire ON session(expire);
      
      CREATE TABLE IF NOT EXISTS logs (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id),
        action VARCHAR(50),
        details TEXT,
        target_id INTEGER,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      -- Tables héritées (conservées pour compatibilité legacy)
      CREATE TABLE IF NOT EXISTS specialties (id SERIAL PRIMARY KEY, name VARCHAR(100), icon VARCHAR(10));
      CREATE TABLE IF NOT EXISTS user_specialties (user_id INTEGER, specialty_id INTEGER, PRIMARY KEY (user_id, specialty_id));
      CREATE TABLE IF NOT EXISTS patients (id SERIAL PRIMARY KEY, first_name VARCHAR(100), last_name VARCHAR(100), created_by INTEGER, photo TEXT, insurance_number VARCHAR(50), chronic_conditions TEXT, phone VARCHAR(20), gender VARCHAR(20), date_of_birth DATE);
      CREATE TABLE IF NOT EXISTS medical_reports (id SERIAL PRIMARY KEY, patient_id INTEGER, medic_id INTEGER, diagnosis TEXT, incident_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP);
    `);

    // 2. MIGRATION DES COLONNES
    const addColumnIfNotExists = async (table, column, type) => {
      const res = await client.query(`SELECT column_name FROM information_schema.columns WHERE table_name='${table}' AND column_name='${column}'`);
      if (res.rows.length === 0) {
        await client.query(`ALTER TABLE ${table} ADD COLUMN ${column} ${type}`);
      }
    };

    await addColumnIfNotExists('users', 'username', 'VARCHAR(50) UNIQUE');
    await addColumnIfNotExists('users', 'password', 'VARCHAR(255)');
    await addColumnIfNotExists('users', 'first_name', 'VARCHAR(100)');
    await addColumnIfNotExists('users', 'last_name', 'VARCHAR(100)');
    await addColumnIfNotExists('users', 'phone', 'VARCHAR(20)');
    await addColumnIfNotExists('users', 'badge_number', 'VARCHAR(20)');
    await addColumnIfNotExists('users', 'grade_id', 'INTEGER REFERENCES grades(id)');
    await addColumnIfNotExists('users', 'visible_grade_id', 'INTEGER REFERENCES grades(id)');
    await addColumnIfNotExists('users', 'profile_picture', 'TEXT');
    await addColumnIfNotExists('users', 'is_admin', 'BOOLEAN DEFAULT FALSE');
    await addColumnIfNotExists('users', 'is_active', 'BOOLEAN DEFAULT TRUE');
    await addColumnIfNotExists('users', 'updated_at', 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP');

    // 3. INITIALISATION DES GRADES LSPD (STRICT)
    const gradesExist = await client.query("SELECT COUNT(*) FROM grades");
    if (parseInt(gradesExist.rows[0].count) === 0) {
      console.log("🔹 Initialisation des grades LSPD...");
      
      const officerPerms = JSON.stringify({ access_dashboard: true, view_roster: true });
      const sergeantPerms = JSON.stringify({ access_dashboard: true, view_roster: true, manage_appointments: true });
      const commandPerms = JSON.stringify({ access_dashboard: true, view_roster: true, manage_appointments: true, manage_users: true, view_logs: true });
      const devPerms = JSON.stringify({ access_dashboard: true, view_roster: true, manage_appointments: true, manage_users: true, delete_users: true, manage_grades: true, view_logs: true });

      await client.query(`
        INSERT INTO grades (name, category, level, color, permissions) VALUES
        ('Officier (Rookie)', 'Officers', 1, '#93c5fd', '${officerPerms}'),
        ('Officier I', 'Officers', 2, '#60a5fa', '${officerPerms}'),
        ('Officier II', 'Officers', 3, '#3b82f6', '${officerPerms}'),
        ('Officier III', 'Officers', 4, '#2563eb', '${officerPerms}'),
        ('Senior Lead Officer (SLO)', 'Officers', 5, '#1d4ed8', '${sergeantPerms}'),
        
        ('Sergent I', 'Supervisors', 6, '#f59e0b', '${sergeantPerms}'),
        ('Sergent II', 'Supervisors', 7, '#d97706', '${sergeantPerms}'),
        
        ('Capitaine I', 'Command Staff', 8, '#cbd5e1', '${commandPerms}'),
        ('Capitaine II', 'Command Staff', 9, '#94a3b8', '${commandPerms}'),
        ('Capitaine III', 'Command Staff', 10, '#64748b', '${commandPerms}'),
        
        ('Commander', 'High Command', 11, '#475569', '${commandPerms}'),
        ('Deputy Chief', 'High Command', 12, '#334155', '${commandPerms}'),
        ('Assistant Chief', 'High Command', 13, '#1e293b', '${commandPerms}'),
        ('Chief of Police', 'High Command', 14, '#0f172a', '${commandPerms}'),
        
        ('Dev', 'Système', 99, '#7c3aed', '${devPerms}')
      `);
    }

    // 4. CRÉATION DU COMPTE ADMIN PAR DÉFAUT
    const adminCheck = await client.query("SELECT * FROM users WHERE username = 'admin'");
    if (adminCheck.rows.length === 0) {
      console.log("⚡ Création du compte admin par défaut...");
      const hashedPassword = await bcrypt.hash("12345", 10);
      
      const devGrade = await client.query("SELECT id FROM grades WHERE level = 99 LIMIT 1");
      const devGradeId = devGrade.rows[0]?.id;

      if (devGradeId) {
        await client.query(`
          INSERT INTO users (username, password, first_name, last_name, badge_number, grade_id, is_admin, is_active)
          VALUES ($1, $2, 'System', 'Admin', '000', $3, TRUE, TRUE)
        `, ['admin', hashedPassword, devGradeId]);
        console.log("✅ Compte 'admin' / '12345' créé avec succès.");
      }
    }

    console.log("✅ Base de données LSPD prête !");

  } catch (e) {
    console.error("❌ ERREUR INIT DB:", e);
  } finally {
    client.release();
  }
};

module.exports = initDatabase;
