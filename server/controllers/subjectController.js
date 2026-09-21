const Subject = require("../models/Subject");

exports.createSubject = async (req, res) => {
  try {
    const subject = await Subject.create(req.body);
    res.status(201).json(subject);
  } catch (err) {
    const status = err.name === "ValidationError" || err.name === "CastError"
      ? 400
      : 500;
    res.status(status).json({ error: err.message });
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

exports.updateSubject = async (req, res) => {
  try {
    const subject = await Subject.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });

    if (!subject) {
      return res.status(404).json({ error: "Subject not found" });
    }

    return res.json(subject);
  } catch (err) {
    const status = err.name === "ValidationError" || err.name === "CastError"
      ? 400
      : 500;
    return res.status(status).json({ error: err.message });
  }
};

exports.deleteSubject = async (req, res) => {
  try {
    const subject = await Subject.findByIdAndDelete(req.params.id);

    if (!subject) {
      return res.status(404).json({ error: "Subject not found" });
    }

    return res.json({ message: "Subject deleted" });
  } catch (err) {
    const status = err.name === "CastError" ? 400 : 500;
    return res.status(status).json({ error: err.message });
  }
};
