require("dotenv").config();
const express = require("express");
const cors = require("cors");
const path = require("path");
const fs = require("fs");
const passport = require("passport");

let rateLimit, helmet, compression;
try { rateLimit = require("express-rate-limit"); } catch (e) { console.warn("⚠️ express-rate-limit non installé"); }
try { helmet = require("helmet"); } catch (e) { console.warn("⚠️ helmet non installé"); }
try { compression = require("compression"); } catch (e) { console.warn("⚠️ compression non installé"); }

const app = express();

// ✅ IMPORTANT: Faire confiance au proxy (Railway, Render, Heroku, etc.)
app.set('trust proxy', 1);

const PORT = process.env.PORT || 3000;
const IS_PROD = process.env.NODE_ENV === "production";

console.log("👮 LSPD MDT System Starting (JWT Mode)...");
console.log(`   Environment: ${IS_PROD ? "PRODUCTION" : "DEVELOPMENT"}`);

// ============================================================================
// MIDDLEWARES DE SÉCURITÉ
// ============================================================================

// Helmet - Headers de sécurité (si installé)
if (helmet) {
  app.use(helmet({
    contentSecurityPolicy: false, // Désactivé pour permettre les inline styles
    crossOriginEmbedderPolicy: false,
    frameguard: false // Désactivé pour permettre l'affichage dans FiveM (iframe)
  }));
  console.log("✅ Helmet activé (iframe autorisée)");
}

// Compression (si installé)
if (compression) {
  app.use(compression());
  console.log("✅ Compression activée");
}

// Health check (avant les autres middlewares)
app.get("/api/health", (req, res) => res.json({ 
  status: "ok", 
  timestamp: new Date().toISOString(),
  env: IS_PROD ? "production" : "development"
}));

// CORS Configuration
const corsOptions = {
  origin: IS_PROD 
    ? process.env.PUBLIC_URL 
    : ["http://localhost:5173", "http://localhost:3000", "http://127.0.0.1:5173"],
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"]
};
app.use(cors(corsOptions));

// Body parsers
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ============================================================================
// RATE LIMITING (si installé)
// ============================================================================
if (rateLimit) {
  // Rate limit global
  const globalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 500, // 500 requêtes par fenêtre
    message: { error: "Trop de requêtes, réessayez plus tard", code: "RATE_LIMITED" },
    standardHeaders: true,
    legacyHeaders: false
  });
  
  // Rate limit strict pour le login
  const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // 5 tentatives de login
    message: { error: "Trop de tentatives de connexion, réessayez dans 15 minutes", code: "LOGIN_RATE_LIMITED" },
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests: true // Ne compte pas les login réussis
  });

  // Rate limit pour les endpoints publics
  const publicLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 heure
    max: 10, // 10 plaintes par heure par IP
    message: { error: "Limite de dépôts de plaintes atteinte", code: "PUBLIC_RATE_LIMITED" }
  });

  app.use("/api", globalLimiter);
  app.use("/api/auth/login", loginLimiter);
  app.use("/api/appointments/public", publicLimiter);
  
  console.log("✅ Rate limiting activé");
} else {
  console.warn("⚠️ Rate limiting DÉSACTIVÉ - Installez express-rate-limit pour plus de sécurité");
}

// ============================================================================
// DÉMARRAGE DU SERVEUR
// ============================================================================
const startServer = async () => {
  try {
    // Vérification des variables d'environnement critiques
    if (!process.env.DATABASE_URL) {
      console.error("❌ FATAL: DATABASE_URL non défini!");
      process.exit(1);
    }
    
    if (!process.env.JWT_SECRET) {
      console.error("❌ FATAL: JWT_SECRET non défini!");
      console.error("   Générez un secret avec: node -e \"console.log(require('crypto').randomBytes(64).toString('hex'))\"");
      process.exit(1);
    }

    const initDatabase = require("./config/initDb");
    const initCentrale = require("./config/initCentrale");
    const { extractUser } = require("./middleware/auth");

    // Init DB (Création tables & Grades LSPD)
    await initDatabase();
    
    // Init Système Centrale
    await initCentrale();

    // Initialisation Passport (sans session)
    app.use(passport.initialize());
    
    // Auth Middleware global (JWT uniquement)
    app.use("/api", extractUser);

    // ========================================================================
    // ROUTES
    // ========================================================================
    
    // Routes Actives LSPD
    app.use("/api/auth", require("./routes/auth"));
    app.use("/api/users", require("./routes/users"));
    app.use("/api/appointments", require("./routes/appointments"));
    app.use("/api/admin", require("./routes/admin"));
    app.use("/api/centrale", require("./routes/centrale"));

    // Routes "Legacy" (gardées pour structure)
    app.use("/api/patients", require("./routes/patients")); 
    app.use("/api/reports", require("./routes/reports"));
    app.use("/api/diagnosis", require("./routes/diagnosis"));

    // ========================================================================
    // ERROR HANDLER GLOBAL
    // ========================================================================
    app.use((err, req, res, next) => {
      console.error("❌ Erreur non gérée:", err);
      
      // Ne pas exposer les détails d'erreur en production
      const errorResponse = {
        error: IS_PROD ? "Erreur serveur interne" : err.message,
        code: "INTERNAL_ERROR"
      };
      
      if (!IS_PROD) {
        errorResponse.stack = err.stack;
      }
      
      res.status(err.status || 500).json(errorResponse);
    });

    // ========================================================================
    // FRONTEND STATIC SERVING
    // ========================================================================
    const distPath = path.resolve(__dirname, "../frontend/dist");
    if (fs.existsSync(distPath)) {
      app.use(express.static(distPath, {
        maxAge: IS_PROD ? '1d' : 0, // Cache en production
        etag: true
      }));
      
      // SPA fallback - toutes les routes non-API vers index.html
      app.get("*", (req, res) => {
        res.sendFile(path.join(distPath, "index.html"));
      });
      console.log("✅ Frontend servi depuis:", distPath);
    } else {
      console.warn("⚠️ Frontend non buildé (frontend/dist manquant)");
      app.get("*", (req, res) => {
        if (!req.path.startsWith("/api")) {
          res.status(503).json({ error: "Frontend non disponible" });
        }
      });
    }

    // ========================================================================
    // LANCEMENT
    // ========================================================================
    app.listen(PORT, () => {
      console.log("═".repeat(50));
      console.log(`🚀 LSPD Server actif sur port ${PORT}`);
      console.log(`   URL: http://localhost:${PORT}`);
      console.log("═".repeat(50));
    });

  } catch (error) {
    console.error("❌ Fatal Error:", error);
    process.exit(1);
  }
};

// Gestion des erreurs non catchées
process.on('uncaughtException', (err) => {
  console.error('❌ Uncaught Exception:', err);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('👋 SIGTERM reçu, arrêt gracieux...');
  process.exit(0);
});

startServer();
