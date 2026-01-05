const express = require("express");
const router = express.Router();
// Route inactive pour LSPD mais nécessaire pour structure
router.get("/", (req, res) => res.json({patients: []}));
module.exports = router;
