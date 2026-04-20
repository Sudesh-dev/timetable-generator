const Subject = require("../models/Subject");

exports.createSubject = async (req, res) => {
  try {
    const subject = await Subject.create(req.body);
    res.status(201).json(subject);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getSubjects = async (req, res) => {
  try {
    const subjects = await Subject.find()
      .populate("allowedTeachers")
      .populate("sectionId");
    res.json(subjects);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};