const express = require("express");
const router = express.Router();
const sectionController = require("../controllers/sectionController");

router.post("/", sectionController.createSection);
router.get("/", sectionController.getSections);

module.exports = router;