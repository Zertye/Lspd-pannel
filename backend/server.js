require("dotenv").config();
const express = require("express");
const cors = require("cors");
const session = require("express-session");
const PgSession = require("connect-pg-simple")(session);
const path = require("path");
const fs = require("fs");

const app = express();
const PORT = process.env.PORT || 3000;
const IS_PROD = process.env.NODE_ENV === "production";

console.log("👮 LSPD MDT System Starting...");

// Health check
app.get("/api/health", (req, res) => res.json({ status: "ok" }));

// Middlewares
app.use(cors({ 
  origin: IS_PROD ? process.env.PUBLIC_URL : true, 
  credentials: true 
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

const startServer = async () => {
  try {
    const pool = require("./config/database");
    const passport = require("./config/passport");
    const initDatabase = require("./config/initDb");
    const initCentrale = require("./config/initCentrale");
    const { extractUser } = require("./middleware/auth");

    // Init DB (Création tables & Grades LSPD)
    await initDatabase();
    
    // Init Système Centrale
    await initCentrale();

    app.use(session({
      store: new PgSession({ pool: pool, tableName: "session", createTableIfMissing: true }),
      secret: process.env.SESSION_SECRET || "lspd-secret-key",
      resave: false, saveUninitialized: false,
      proxy: true,
      cookie: { 
        secure: IS_PROD,
        httpOnly: true, 
        maxAge: 7 * 24 * 60 * 60 * 1000 
      }
    }));

    // Patch ROBUSTE pour Passport 0.6+ - ajouter les méthodes manquantes à la session
    // Ce patch doit s'exécuter AVANT passport.initialize()
    app.use((req, res, next) => {
      // Si pas de session, en créer une factice pour éviter les crashes
      if (!req.session) {
        req.session = {};
      }
      
      // Toujours ajouter regenerate si manquant
      if (typeof req.session.regenerate !== 'function') {
        req.session.regenerate = (cb) => {
          if (typeof cb === 'function') cb(null);
        };
      }
      
      // Toujours ajouter save si manquant
      if (typeof req.session.save !== 'function') {
        req.session.save = (cb) => {
          if (typeof cb === 'function') cb(null);
        };
      }
      
      // Toujours ajouter destroy si manquant
      if (typeof req.session.destroy !== 'function') {
        req.session.destroy = (cb) => {
          req.session = null;
          if (typeof cb === 'function') cb(null);
        };
      }
      
      next();
    });

    app.use(passport.initialize());
    app.use(passport.session());
    
    // Auth Middleware global
    app.use("/api", extractUser);

    // Routes Actives LSPD
    app.use("/api/auth", require("./routes/auth"));
    app.use("/api/users", require("./routes/users"));
    app.use("/api/appointments", require("./routes/appointments")); // Gestion Plaintes
    app.use("/api/admin", require("./routes/admin"));
    app.use("/api/centrale", require("./routes/centrale")); // Système Centrale

    // Routes "Legacy" (gardées pour éviter les erreurs d'import mais vides/inutilisées par le front)
    app.use("/api/patients", require("./routes/patients")); 
    app.use("/api/reports", require("./routes/reports"));
    app.use("/api/diagnosis", require("./routes/diagnosis"));

    // Frontend Static Serving
    const distPath = path.resolve(__dirname, "../frontend/dist");
    if (fs.existsSync(distPath)) {
      app.use(express.static(distPath));
      app.get("*", (req, res) => res.sendFile(path.join(distPath, "index.html")));
      console.log("✅ Frontend served.");
    }

    app.listen(PORT, () => console.log(`🚀 LSPD Server active on port ${PORT}`));

  } catch (error) {
    console.error("❌ Fatal Error:", error);
  }
};

startServer();
