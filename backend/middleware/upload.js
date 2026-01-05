const multer = require("multer");
const storage = multer.memoryStorage();
const fileFilter = (req, file, cb) => {
  if (/jpeg|jpg|png|webp/.test(file.mimetype)) cb(null, true);
  else cb(new Error("Format invalide."));
};
const upload = multer({ storage, limits: { fileSize: 3 * 1024 * 1024 }, fileFilter });
module.exports = upload;
