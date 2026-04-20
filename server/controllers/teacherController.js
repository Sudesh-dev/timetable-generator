const Teacher = require("../models/Teacher");

exports.createTeacher = async (req, res) => {
  try {
    const teacher = await Teacher.create(req.body);
    res.status(201).json(teacher);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getTeachers = async (req, res) => {
  try {
    const teachers = await Teacher.find().populate("subjects");
    res.json(teachers);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};