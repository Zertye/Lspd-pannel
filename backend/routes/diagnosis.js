const express = require("express");
const router = express.Router();
// Route inactive pour LSPD mais nécessaire pour structure
router.get("/symptoms", (req, res) => res.json([]));
module.exports = router;
