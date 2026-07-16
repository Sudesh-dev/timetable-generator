const express = require("express");
const router = express.Router();
const timetableController = require("../controllers/timetableController");

// ✅ specific routes FIRST
router.post("/generate", timetableController.generateAndSave);
router.get("/teacher/:teacherId", timetableController.getByTeacher);
router.get("/", timetableController.getAll);
router.put("/slot", timetableController.updateSlot);

// ❗ dynamic route LAST
router.get("/:sectionId", timetableController.getBySection);

module.exports = router;