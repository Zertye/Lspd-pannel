const passport = require("passport");
const LocalStrategy = require("passport-local").Strategy;
const bcrypt = require("bcrypt");
const pool = require("./database");

// Sérialisation factice (Stateless)
passport.serializeUser((user, done) => {
  done(null, user.id);
});

passport.deserializeUser((id, done) => {
  done(null, null);
});

// Stratégie locale (Optionnelle si vous n'utilisez pas passport.authenticate('local'))
passport.use(new LocalStrategy(async (username, password, done) => {
  try {
    const result = await pool.query("SELECT * FROM users WHERE username = $1", [username]);
    if (result.rows.length === 0) return done(null, false, { message: "Utilisateur inconnu." });

    const user = result.rows[0];
    const match = await bcrypt.compare(password, user.password);
    if (!match) return done(null, false, { message: "Mot de passe incorrect." });
    if (!user.is_active) return done(null, false, { message: "Compte désactivé." });

    return done(null, user);
  } catch (err) {
    return done(err);
  }
}));

module.exports = passport;
