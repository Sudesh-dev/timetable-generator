const Section = require("../models/Section");
require("../models/Department");

exports.createSection = async (req, res) => {
  try {
    const section = await Section.create(req.body);
    res.status(201).json(section);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getSections = async (req, res) => {
  try {
    const sections = await Section.find().populate("departmentId");
    res.json(sections);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.updateSection = async (req, res) => {
  try {
    const section = await Section.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });

    if (!section) {
      return res.status(404).json({ error: "Section not found" });
    }

    res.json(section);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.deleteSection = async (req, res) => {
  try {
    const section = await Section.findByIdAndDelete(req.params.id);

    if (!section) {
      return res.status(404).json({ error: "Section not found" });
    }

    res.json({ message: "Section deleted" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};