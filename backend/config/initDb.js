const pool = require("./database");
const bcrypt = require("bcrypt");

const initDatabase = async () => {
  const client = await pool.connect();
  try {
    console.log("👮 LSPD Database Check & Init...");

    // ========================================================================
    // 1. CRÉATION DES TABLES
    // ========================================================================
    await client.query(`
      -- Table des grades (hiérarchie et permissions)
      CREATE TABLE IF NOT EXISTS grades (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        category VARCHAR(100),
        level INTEGER DEFAULT 1 UNIQUE,
        color VARCHAR(20) DEFAULT '#3b82f6',
        permissions JSONB DEFAULT '{}',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      -- Table des utilisateurs (officiers)
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(50) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        first_name VARCHAR(100),
        last_name VARCHAR(100),
        phone VARCHAR(20),
        badge_number VARCHAR(20),
        grade_id INTEGER REFERENCES grades(id),
        visible_grade_id INTEGER REFERENCES grades(id),
        profile_picture TEXT,
        is_admin BOOLEAN DEFAULT FALSE,
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      
      -- Table des plaintes
      CREATE TABLE IF NOT EXISTS appointments (
        id SERIAL PRIMARY KEY, 
        patient_name VARCHAR(200) NOT NULL,
        patient_phone VARCHAR(20), 
        patient_discord VARCHAR(100), 
        appointment_type VARCHAR(50) NOT NULL,
        preferred_date DATE,
        preferred_time TIME, 
        description TEXT, 
        status VARCHAR(20) DEFAULT 'pending',
        assigned_medic_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
        completed_by_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
        completion_notes TEXT, 
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, 
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      
      -- Tables legacy (compatibilité)
      CREATE TABLE IF NOT EXISTS patients (
        id SERIAL PRIMARY KEY, 
        first_name VARCHAR(100), 
        last_name VARCHAR(100), 
        created_by INTEGER REFERENCES users(id) ON DELETE SET NULL, 
        photo TEXT, 
        insurance_number VARCHAR(50), 
        chronic_conditions TEXT, 
        phone VARCHAR(20), 
        gender VARCHAR(20), 
        date_of_birth DATE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // ========================================================================
    // TABLE LOGS - Création avec contrainte ON DELETE SET NULL correcte
    // ========================================================================
    const logsExists = await client.query(`
      SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'logs')
    `);
    
    if (!logsExists.rows[0].exists) {
      await client.query(`
        CREATE TABLE logs (
          id SERIAL PRIMARY KEY,
          user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
          action VARCHAR(100) NOT NULL,
          details TEXT,
          target_type VARCHAR(50),
          target_id INTEGER,
          ip_address VARCHAR(45),
          user_agent TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        CREATE INDEX idx_logs_user ON logs(user_id);
        CREATE INDEX idx_logs_action ON logs(action);
        CREATE INDEX idx_logs_created ON logs(created_at DESC);
      `);
      console.log("  → Table logs créée");
    }

    // ========================================================================
    // 2. MIGRATION DES COLONNES (mise à jour structure existante)
    // ========================================================================
    const addColumnIfNotExists = async (table, column, type) => {
      const res = await client.query(`
        SELECT column_name FROM information_schema.columns 
        WHERE table_name = $1 AND column_name = $2
      `, [table, column]);
      
      if (res.rows.length === 0) {
        console.log(`  → Ajout colonne ${table}.${column}`);
        await client.query(`ALTER TABLE ${table} ADD COLUMN ${column} ${type}`);
      }
    };

    await addColumnIfNotExists('appointments', 'completed_by_id', 'INTEGER REFERENCES users(id) ON DELETE SET NULL');
    await addColumnIfNotExists('grades', 'updated_at', 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP');
    await addColumnIfNotExists('logs', 'target_type', 'VARCHAR(50)');
    await addColumnIfNotExists('logs', 'ip_address', 'VARCHAR(45)');
    await addColumnIfNotExists('logs', 'user_agent', 'TEXT');

    // ========================================================================
    // 3. INITIALISATION DES GRADES LSPD
    // ========================================================================
    const gradesExist = await client.query("SELECT COUNT(*) FROM grades");
    
    if (parseInt(gradesExist.rows[0].count) === 0) {
      console.log("🔹 Initialisation des grades LSPD...");
      
      const permSets = {
        officer: { access_dashboard: true, view_roster: true, manage_appointments: false, delete_appointments: false, manage_users: false, delete_users: false, manage_grades: false, view_logs: false },
        supervisor: { access_dashboard: true, view_roster: true, manage_appointments: true, delete_appointments: false, manage_users: false, delete_users: false, manage_grades: false, view_logs: false },
        command: { access_dashboard: true, view_roster: true, manage_appointments: true, delete_appointments: true, manage_users: true, delete_users: false, manage_grades: false, view_logs: true },
        highCommand: { access_dashboard: true, view_roster: true, manage_appointments: true, delete_appointments: true, manage_users: true, delete_users: true, manage_grades: false, view_logs: true },
        dev: { access_dashboard: true, view_roster: true, manage_appointments: true, delete_appointments: true, manage_users: true, delete_users: true, manage_grades: true, view_logs: true }
      };

      await client.query(`
        INSERT INTO grades (name, category, level, color, permissions) VALUES
        ('Officier (Rookie)', 'Officers', 1, '#93c5fd', $1),
        ('Officier I', 'Officers', 2, '#60a5fa', $1),
        ('Officier II', 'Officers', 3, '#3b82f6', $1),
        ('Officier III', 'Officers', 4, '#2563eb', $1),
        ('Senior Lead Officer', 'Officers', 5, '#1d4ed8', $2),
        ('Sergent I', 'Supervisors', 6, '#f59e0b', $2),
        ('Sergent II', 'Supervisors', 7, '#d97706', $2),
        ('Capitaine I', 'Command Staff', 8, '#cbd5e1', $3),
        ('Capitaine II', 'Command Staff', 9, '#94a3b8', $3),
        ('Capitaine III', 'Command Staff', 10, '#64748b', $3),
        ('Commander', 'High Command', 11, '#475569', $4),
        ('Deputy Chief', 'High Command', 12, '#334155', $4),
        ('Assistant Chief', 'High Command', 13, '#1e293b', $4),
        ('Chief of Police', 'High Command', 14, '#0f172a', $4),
        ('Développeur', 'Système', 99, '#7c3aed', $5)
      `, [
        JSON.stringify(permSets.officer),
        JSON.stringify(permSets.supervisor),
        JSON.stringify(permSets.command),
        JSON.stringify(permSets.highCommand),
        JSON.stringify(permSets.dev)
      ]);
    }

    // ========================================================================
    // 4. CRÉATION COMPTE DEV PAR DÉFAUT
    // ========================================================================
    const usersExist = await client.query("SELECT COUNT(*) FROM users");
    
    if (parseInt(usersExist.rows[0].count) === 0) {
      console.log("🔹 Création du compte administrateur par défaut...");
      const devGrade = await client.query("SELECT id FROM grades WHERE level = 99");
      if (devGrade.rows.length > 0) {
        const hashedPassword = await bcrypt.hash("admin123", 10);
        await client.query(`
          INSERT INTO users (username, password, first_name, last_name, badge_number, grade_id, is_admin, is_active)
          VALUES ($1, $2, $3, $4, $5, $6, TRUE, TRUE)
        `, ["admin", hashedPassword, "Admin", "LSPD", "DEV-001", devGrade.rows[0].id]);
        console.log("✅ Compte admin créé (login: admin / mdp: admin123)");
      }
    }

    console.log("✅ Base de données LSPD prête !");

  } catch (e) {
    console.error("❌ ERREUR INIT DB:", e);
    throw e;
  } finally {
    client.release();
  }
};

module.exports = initDatabase;
