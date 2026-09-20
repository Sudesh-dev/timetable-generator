const Subject = require("../models/Subject");
const Teacher = require("../models/Teacher");
const Section = require("../models/Section");
const Timetable = require("../models/Timetable");
const { generateTimetable } = require("../services/generator");
const {
  getCellEntries,
  normalizeGrid,
  withNormalizedGrid,
} = require("../services/timetableGrid");

exports.generateAndSave = async (req, res) => {
  try {
    const { sectionId, classroom, roomPool } = req.body;

    if (!sectionId) {
      return res.status(400).json({ error: "sectionId is required" });
    }

    const section = await Section.findById(sectionId);
    if (!section) {
      return res.status(404).json({ error: "Section not found" });
    }

    const [subjects, teachers, existingTimetables] = await Promise.all([
      Subject.find({ sectionId }),
      Teacher.find(),
      Timetable.find({ sectionId: { $ne: sectionId } }).lean(),
    ]);
    const selectedClassroom = section.classroom || classroom;
    const result = generateTimetable(subjects, teachers, roomPool || [], {
      classroom: selectedClassroom,
      existingTimetables,
    });

    const saved = await Timetable.findOneAndUpdate(
      { sectionId },
      {
        sectionId,
        departmentId: section.departmentId || null,
        semester: section.semester,
        classroom: selectedClassroom,
        grid: result.timetable,
        warnings: result.warnings,
        status: "generated",
        generatedAt: new Date(),
      },
      { upsert: true, new: true }
    );

    return res.json({
      success: result.success,
      timetable: withNormalizedGrid(saved),
      warnings: result.warnings,
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

exports.getBySection = async (req, res) => {
  try {
    const timetable = await Timetable.findOne({ sectionId: req.params.sectionId })
      .populate("sectionId")
      .lean();

    if (!timetable) {
      return res.status(404).json({ error: "Timetable not found" });
    }

    return res.json(withNormalizedGrid(timetable));
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

exports.getByTeacher = async (req, res) => {
  try {
    const { teacherId } = req.params;
    const timetables = await Timetable.find().populate("sectionId").lean();

    const filtered = timetables.map((rawTimetable) => {
      const timetable = withNormalizedGrid(rawTimetable);
      const teacherGrid = timetable.grid.map((day) =>
        day.map((cell) => {
          const matches = getCellEntries(cell).filter(
            (entry) => String(entry.teacherId) === String(teacherId)
          );

          if (matches.length === 0) return null;
          return matches.length === 1 ? matches[0] : matches;
        })
      );

      return {
        timetableId: timetable._id,
        section: timetable.sectionId,
        semester: timetable.semester,
        classroom: timetable.classroom,
        grid: teacherGrid,
        warnings: timetable.warnings,
      };
    });

    return res.json(
      filtered.filter((timetable) =>
        timetable.grid.some((day) => day.some((cell) => cell !== null))
      )
    );
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

exports.getAll = async (req, res) => {
  try {
    const timetables = await Timetable.find()
      .sort({ updatedAt: -1 })
      .populate("sectionId")
      .lean();

    return res.json(timetables.map(withNormalizedGrid));
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

exports.updateSlot = async (req, res) => {
  try {
    const { timetableId, day, slot, value } = req.body;

    if (timetableId === undefined || day === undefined || slot === undefined) {
      return res.status(400).json({
        error: "timetableId, day, and slot are required",
      });
    }

    const timetable = await Timetable.findById(timetableId);
    if (!timetable) {
      return res.status(404).json({ error: "Timetable not found" });
    }

    const dayIndex = Number(day);
    const slotIndex = Number(slot);
    if (!Number.isInteger(dayIndex) || !Number.isInteger(slotIndex)) {
      return res.status(400).json({ error: "day and slot must be integers" });
    }

    const grid = normalizeGrid(timetable.grid);
    if (!grid[dayIndex] || slotIndex < 0 || slotIndex >= grid[dayIndex].length) {
      return res.status(400).json({ error: "Invalid day or slot index" });
    }

    grid[dayIndex][slotIndex] = value || null;
    timetable.grid = grid;
    timetable.status = "edited";
    timetable.markModified("grid");
    await timetable.save();

    return res.json({ success: true, timetable: withNormalizedGrid(timetable) });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};
