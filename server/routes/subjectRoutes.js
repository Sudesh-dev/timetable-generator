const express = require("express");
const router = express.Router();
const subjectController = require("../controllers/subjectController");

const Subject = require("../models/Subject"); // 👈 add this

router.post("/", subjectController.createSubject);
router.get("/", subjectController.getSubjects);


router.delete("/:id", async (req, res) => {
  try {
    await Subject.findByIdAndDelete(req.params.id);
    res.json({ message: "Deleted" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;