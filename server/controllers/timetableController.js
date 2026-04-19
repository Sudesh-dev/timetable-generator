const Subject = require('../models/Subject');
const Teacher = require('../models/Teacher');
const Timetable = require('../models/Timetable');
const { generateTimetable } = require('../services/generator');

exports.generate = async (req, res) => {
  const subjects = await Subject.find();
  const teachers = await Teacher.find();

  const roomPool = req.body?.roomPool || [];

  const result = generateTimetable(subjects, teachers, roomPool);

  const saved = await Timetable.create({
    sectionId: null, // for now
    days: result.timetable,
    warnings: result.warnings
  });

  res.json({
    message: "Timetable generated & saved",
    timetable: saved
  });
};

exports.getAll = async (req, res) => {
  const data = await Timetable.find();
  res.json(data);
};