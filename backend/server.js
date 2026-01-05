require("dotenv").config();
const express = require("express");
const cors = require("cors");
const session = require("express-session");
const PgSession = require("connect-pg-simple")(session);
const path = require("path");
const fs = require("fs");

const app = express();
const PORT = process.env.PORT || 3000;

console.log("👮 LSPD MDT System Starting...");

app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

const startServer = async () => {
  try {
    const pool = require("./config/database");
    const passport = require("./config/passport");
    const initDatabase = require("./config/initDb");
    const { extractUser } = require("./middleware/auth");

    // Init DB (Création tables & Grades LSPD)
    await initDatabase();

    app.use(session({
      store: new PgSession({ pool: pool, tableName: "session", createTableIfMissing: true }),
      secret: process.env.SESSION_SECRET || "lspd-secret-key",
      resave: false, saveUninitialized: false,
      cookie: { secure: process.env.NODE_ENV === "production", maxAge: 7 * 24 * 60 * 60 * 1000 }
    }));

    app.use(passport.initialize());
    app.use(passport.session());
    app.use("/api", extractUser);

    // Routes
    app.use("/api/auth", require("./routes/auth"));
    app.use("/api/users", require("./routes/users"));
    app.use("/api/appointments", require("./routes/appointments")); // Gestion Plaintes
    app.use("/api/admin", require("./routes/admin"));

    // Routes "Legacy" (gardées pour éviter les erreurs d'import mais vides/inutilisées par le front)
    app.use("/api/patients", require("./routes/patients")); 
    app.use("/api/reports", require("./routes/reports"));
    app.use("/api/diagnosis", require("./routes/diagnosis"));

    // Frontend
    const distPath = path.resolve(__dirname, "../frontend/dist");
    if (fs.existsSync(distPath)) {
      app.use(express.static(distPath));
      app.get("*", (req, res) => res.sendFile(path.join(distPath, "index.html")));
    }

    app.listen(PORT, () => console.log(`🚀 LSPD Server active on port ${PORT}`));

  } catch (error) {
    console.error("❌ Fatal Error:", error);
  }
};

startServer();
