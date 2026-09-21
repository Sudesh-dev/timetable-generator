const express = require("express");
const router = express.Router();
const subjectController = require("../controllers/subjectController");

router.post("/", subjectController.createSubject);
router.get("/", subjectController.getSubjects);
router.put("/:id", subjectController.updateSubject);
router.delete("/:id", subjectController.deleteSubject);

module.exports = router;
