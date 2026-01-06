const pool = require("./database");

/**
 * Initialise les tables pour le système de Centrale LSPD
 */
const initCentrale = async () => {
  const client = await pool.connect();
  try {
    console.log("📡 Initialisation du système Centrale LSPD...");

    await client.query(`
      -- ========================================================================
      -- TABLE: Services (Prise/Fin de service des officiers)
      -- ========================================================================
      CREATE TABLE IF NOT EXISTS services (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        start_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        end_time TIMESTAMP,
        total_duration INTEGER DEFAULT 0, -- en secondes
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_services_user ON services(user_id);
      CREATE INDEX IF NOT EXISTS idx_services_active ON services(is_active);

      -- ========================================================================
      -- TABLE: Centrale (Qui est opérateur centrale)
      -- ========================================================================
      CREATE TABLE IF NOT EXISTS centrale_operators (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE UNIQUE,
        assigned_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
        assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        is_active BOOLEAN DEFAULT TRUE
      );

      -- ========================================================================
      -- TABLE: Patrouilles
      -- ========================================================================
      CREATE TABLE IF NOT EXISTS patrols (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        call_sign VARCHAR(50), -- Indicatif radio (ex: ADAM-12)
        vehicle VARCHAR(100), -- Véhicule assigné
        sector VARCHAR(100), -- Secteur de patrouille
        status VARCHAR(30) DEFAULT 'available', -- available, busy, emergency, break, offline
        priority INTEGER DEFAULT 0, -- 0=normal, 1=prioritaire, 2=urgence
        notes TEXT,
        created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      -- ========================================================================
      -- TABLE: Membres des patrouilles
      -- ========================================================================
      CREATE TABLE IF NOT EXISTS patrol_members (
        id SERIAL PRIMARY KEY,
        patrol_id INTEGER REFERENCES patrols(id) ON DELETE CASCADE,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        role VARCHAR(50) DEFAULT 'member', -- leader, member
        joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(patrol_id, user_id)
      );
      CREATE INDEX IF NOT EXISTS idx_patrol_members_patrol ON patrol_members(patrol_id);
      CREATE INDEX IF NOT EXISTS idx_patrol_members_user ON patrol_members(user_id);

      -- ========================================================================
      -- TABLE: Notes de centrale (Journal de bord)
      -- ========================================================================
      CREATE TABLE IF NOT EXISTS centrale_notes (
        id SERIAL PRIMARY KEY,
        author_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
        patrol_id INTEGER REFERENCES patrols(id) ON DELETE CASCADE,
        content TEXT NOT NULL,
        note_type VARCHAR(30) DEFAULT 'info', -- info, warning, urgent, dispatch
        is_pinned BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_centrale_notes_patrol ON centrale_notes(patrol_id);
      CREATE INDEX IF NOT EXISTS idx_centrale_notes_created ON centrale_notes(created_at DESC);

      -- ========================================================================
      -- TABLE: Historique des dispatches/appels
      -- ========================================================================
      CREATE TABLE IF NOT EXISTS dispatch_calls (
        id SERIAL PRIMARY KEY,
        patrol_id INTEGER REFERENCES patrols(id) ON DELETE SET NULL,
        call_type VARCHAR(100) NOT NULL,
        location VARCHAR(255),
        description TEXT,
        priority INTEGER DEFAULT 0,
        status VARCHAR(30) DEFAULT 'pending', -- pending, dispatched, en_route, on_scene, completed, cancelled
        dispatched_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
        dispatched_at TIMESTAMP,
        completed_at TIMESTAMP,
        completion_notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_dispatch_calls_status ON dispatch_calls(status);
      CREATE INDEX IF NOT EXISTS idx_dispatch_calls_patrol ON dispatch_calls(patrol_id);
    `);

    // Ajout colonne total_patrol_time dans users si elle n'existe pas
    const checkColumn = await client.query(`
      SELECT column_name FROM information_schema.columns 
      WHERE table_name = 'users' AND column_name = 'total_patrol_time'
    `);
    
    if (checkColumn.rows.length === 0) {
      console.log("  → Ajout colonne users.total_patrol_time");
      await client.query(`ALTER TABLE users ADD COLUMN total_patrol_time INTEGER DEFAULT 0`);
    }

    console.log("✅ Système Centrale initialisé !");

  } catch (e) {
    console.error("❌ ERREUR INIT CENTRALE:", e);
    throw e;
  } finally {
    client.release();
  }
};

module.exports = initCentrale;
