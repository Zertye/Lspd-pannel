require("dotenv").config();
const express = require("express");
const cors = require("cors");
// SUPPRIMÉ: const session = ...
// SUPPRIMÉ: const PgSession = ...
const path = require("path");
const fs = require("fs");

const app = express();
const PORT = process.env.PORT || 3000;
const IS_PROD = process.env.NODE_ENV === "production";

console.log("👮 LSPD MDT System Starting (JWT Mode)...");

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
    const initDatabase = require("./config/initDb");
    const initCentrale = require("./config/initCentrale");
    const { extractUser } = require("./middleware/auth");
    
    // On garde passport.initialize() si tu utilises passport ailleurs, 
    // mais on retire passport.session() car il nécessite express-session.
    const passport = require("passport");
    app.use(passport.initialize());

    // Init DB
    await initDatabase();
    await initCentrale();

    // SUPPRIMÉ: Bloc app.use(session({...}))
    // SUPPRIMÉ: Bloc "Patch ROBUSTE pour Passport"
    // SUPPRIMÉ: app.use(passport.session());

    // Auth Middleware global (JWT uniquement)
    app.use("/api", extractUser);

    // Routes
    app.use("/api/auth", require("./routes/auth"));
    app.use("/api/users", require("./routes/users"));
    app.use("/api/appointments", require("./routes/appointments"));
    app.use("/api/admin", require("./routes/admin"));
    app.use("/api/centrale", require("./routes/centrale"));

    // Routes Legacy
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
