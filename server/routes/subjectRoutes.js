const express = require("express");
const router = express.Router();
const subjectController = require("../controllers/subjectController");

router.post("/", subjectController.createSubject);
router.get("/", subjectController.getSubjects);

module.exports = router;