const Subject = require("../models/Subject");
const Teacher = require("../models/Teacher");
const Section = require("../models/Section");
const Timetable = require("../models/Timetable");
const {
  generateTimetable,
  getEntries,
  normalizeGrid,
} = require("../services/generator");

exports.generateAndSave = async (req, res) => {
  try {
    const { sectionId, roomPool } = req.body;

    if (!sectionId) {
      return res.status(400).json({
        error: "sectionId is required",
      });
    }

    const section = await Section.findById(sectionId);
    if (!section) {
      return res.status(404).json({ error: "Section not found" });
    }

    const subjects = await Subject.find({
      sectionId,
    });

    const [teachers, existingTimetables] = await Promise.all([
      Teacher.find(),
      Timetable.find({ sectionId: { $ne: section._id } })
        .select("sectionId classroom grid")
        .populate("sectionId", "classroom")
        .lean(),
    ]);

    const result = generateTimetable(subjects, teachers, roomPool || [], {
      classroom: section.classroom,
      existingTimetables,
      // A retry explores another ordering among equally valid candidates while
      // keeping every hard constraint and all saved timetable clashes intact.
      variationSeed: req.body.variationSeed || Date.now(),
    });

    // Never replace a previously usable timetable with an incomplete result.
    // The caller receives the candidate grid and exact warnings for diagnosis,
    // while MongoDB remains unchanged and can be used safely on the next retry.
    if (!result.success) {
      return res.status(422).json({
        success: false,
        error: "A complete conflict-free timetable could not be generated.",
        timetable: {
          sectionId,
          semester: section.semester,
          classroom: section.classroom,
          grid: result.timetable,
        },
        warnings: result.warnings,
        checkedTimetables: existingTimetables.length,
      });
    }

    const saved = await Timetable.findOneAndUpdate(
      { sectionId },
      {
        sectionId,
        departmentId: section.departmentId || null,
        semester: section.semester,
        classroom: section.classroom,
        grid: result.timetable,
        warnings: result.warnings || [],
        generationContext: {
          constraintVersion: "college-v2",
          referencedTimetableIds: existingTimetables
            .map((timetable) => timetable._id)
            .filter(Boolean),
        },
        status: "generated",
        generatedAt: new Date(),
      },
      { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true }
    );

    return res.json({
      success: result.success,
      timetable: saved,
      warnings: result.warnings,
      checkedTimetables: existingTimetables.length,
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
      .lean();

    if (!timetable) {
      return res.status(404).json({ error: "Timetable not found" });
    }

    timetable.grid = normalizeGrid(timetable.grid);
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
      .lean();

    const filtered = timetables.map((tt) => {
      const teacherGrid = normalizeGrid(tt.grid).map((day) =>
        day.map((cell) => {
          if (!cell) return null;
          const matches = getEntries(cell).filter(
            (item) => String(item.teacherId) === String(teacherId)
          );
          if (matches.length === 0) return null;
          return matches.length === 1 ? matches[0] : matches;
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
      .lean();

    return res.json(
      timetables.map((timetable) => ({
        ...timetable,
        grid: normalizeGrid(timetable.grid),
      }))
    );
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

    timetable.grid = normalizeGrid(timetable.grid);

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
    timetable.markModified("grid");
    await timetable.save();

    return res.json({
      success: true,
      timetable,
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};
