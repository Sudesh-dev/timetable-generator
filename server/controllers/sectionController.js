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