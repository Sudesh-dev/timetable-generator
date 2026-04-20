const Subject = require("../models/Subject");
const Teacher = require("../models/Teacher");
const Section = require("../models/Section");
const Timetable = require("../models/Timetable");
const { generateTimetable } = require("../services/generator");

exports.generateAndSave = async (req, res) => {
  try {
    const { sectionId, classroom, roomPool } = req.body;

    if (!sectionId || !classroom) {
      return res.status(400).json({
        error: "sectionId and classroom are required",
      });
    }

    const section = await Section.findById(sectionId);
    if (!section) {
      return res.status(404).json({ error: "Section not found" });
    }

    const subjects = await Subject.find({
      sectionId,
    });

    const teachers = await Teacher.find();

    // ✅ FIX HERE
    const result = generateTimetable(
      subjects,
      teachers,
      roomPool || []
    );

    const saved = await Timetable.findOneAndUpdate(
      { sectionId },
      {
        sectionId,
        departmentId: section.departmentId || null,
        semester: section.semester,
        classroom,
        grid: result.timetable,
        warnings: result.warnings || [],
        status: result.success ? "generated" : "edited",
        generatedAt: new Date(),
      },
      { upsert: true, new: true }
    );

    return res.json({
      success: result.success,
      timetable: saved,
      warnings: result.warnings,
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

exports.getBySection = async (req, res) => {
  try {
    const { sectionId } = req.params;

    const timetable = await Timetable.findOne({ sectionId })
      .populate("sectionId")

    if (!timetable) {
      return res.status(404).json({ error: "Timetable not found" });
    }

    return res.json(timetable);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

exports.getByTeacher = async (req, res) => {
  try {
    const { teacherId } = req.params;

    const timetables = await Timetable.find()
      .populate("sectionId")

    const filtered = timetables.map((tt) => {
      const teacherGrid = tt.grid.map((day) =>
        day.map((cell) => {
          if (!cell) return null;

          if (Array.isArray(cell)) {
            const matches = cell.filter(
              (item) => String(item.teacherId) === String(teacherId)
            );
            return matches.length ? matches : null;
          }

          if (String(cell.teacherId) === String(teacherId)) {
            return cell;
          }

          return null;
        })
      );

      return {
        timetableId: tt._id,
        section: tt.sectionId,
        semester: tt.semester,
        classroom: tt.classroom,
        grid: teacherGrid,
        warnings: tt.warnings,
      };
    });

    const onlyWithClasses = filtered.filter((t) =>
      t.grid.some((day) => day.some((cell) => cell !== null))
    );

    return res.json(onlyWithClasses);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

exports.getAll = async (req, res) => {
  try {
    const timetables = await Timetable.find()
      .sort({ updatedAt: -1 })
      .populate("sectionId")
      

    return res.json(timetables);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

exports.updateSlot = async (req, res) => {
  try {
    const { timetableId, day, slot, value } = req.body;

    if (
      timetableId === undefined ||
      day === undefined ||
      slot === undefined
    ) {
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

    if (dayIndex < 0 || dayIndex >= timetable.grid.length) {
      return res.status(400).json({ error: "Invalid day index" });
    }

    if (!Array.isArray(timetable.grid[dayIndex])) {
      return res.status(400).json({ error: "Invalid timetable day data" });
    }

    if (slotIndex < 0 || slotIndex >= timetable.grid[dayIndex].length) {
      return res.status(400).json({ error: "Invalid slot index" });
    }

    timetable.grid[dayIndex][slotIndex] = value || null;
    timetable.status = "edited";
    await timetable.save();

    return res.json({
      success: true,
      timetable,
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};