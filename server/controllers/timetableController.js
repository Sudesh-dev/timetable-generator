const Subject = require("../models/Subject");
const Teacher = require("../models/Teacher");
const Section = require("../models/Section");
const Timetable = require("../models/Timetable");
const {
  DAYS,
  SLOTS,
  generateTimetable,
  getEntries,
  normalizeGrid,
  validateEditedTimetable,
} = require("../services/generator");

function resolveVariationSeed(value) {
  if (value === undefined || value === null || value === "") return Date.now();
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : Date.now();
}

function isISOCalendarDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

function normalizeWorkingPeriod(value) {
  const startDate = String(value?.startDate || "").trim();
  const endDate = String(value?.endDate || "").trim();

  if (
    !isISOCalendarDate(startDate) ||
    !isISOCalendarDate(endDate) ||
    endDate < startDate
  ) {
    return null;
  }

  return { startDate, endDate };
}

function isExactGrid(grid) {
  return (
    Array.isArray(grid) &&
    grid.length === DAYS &&
    grid.every((day) => Array.isArray(day) && day.length === SLOTS)
  );
}

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (!value || typeof value !== "object") return value;

  return Object.keys(value)
    .sort()
    .reduce((result, key) => {
      result[key] = canonicalize(value[key]);
      return result;
    }, {});
}

function gridsMatch(first, second) {
  return (
    JSON.stringify(canonicalize(normalizeGrid(first))) ===
    JSON.stringify(canonicalize(normalizeGrid(second)))
  );
}

function sortedRecords(values, primaryField) {
  return [...values].sort((first, second) => {
    const primary = String(first?.[primaryField] || "").localeCompare(
      String(second?.[primaryField] || "")
    );
    if (primary !== 0) return primary;
    return String(first?._id || "").localeCompare(String(second?._id || ""));
  });
}

function previewTimetable(section, grid, existingTimetables, workingPeriod) {
  return {
    sectionId: section._id,
    departmentId: section.departmentId || null,
    semester: section.semester,
    classroom: section.classroom,
    workingPeriod,
    grid,
    warnings: [],
    generationContext: {
      constraintVersion: "college-v3-round-robin",
      referencedTimetableIds: existingTimetables
        .map((timetable) => timetable._id)
        .filter(Boolean),
    },
    status: "preview",
  };
}

async function generateForSection(sectionId, roomPool, variationSeed) {
  const section = await Section.findById(sectionId);
  if (!section) return null;

  const subjectRecords = await Subject.find({ sectionId });
  const [teacherRecords, timetableRecords] = await Promise.all([
    Teacher.find(),
    Timetable.find({ sectionId: { $ne: section._id } })
      .select("sectionId classroom grid")
      .populate("sectionId", "classroom")
      .lean(),
  ]);
  const subjects = sortedRecords(subjectRecords, "code");
  const teachers = sortedRecords(teacherRecords, "teacherId");
  const existingTimetables = sortedRecords(timetableRecords, "_id");

  const result = generateTimetable(subjects, teachers, roomPool || [], {
    classroom: section.classroom,
    existingTimetables,
    variationSeed,
  });

  return { section, existingTimetables, result };
}

async function validateEditedForSection(sectionId, roomPool, grid) {
  const section = await Section.findById(sectionId);
  if (!section) return null;

  const subjectRecords = await Subject.find({ sectionId });
  const [teacherRecords, timetableRecords] = await Promise.all([
    Teacher.find(),
    Timetable.find({ sectionId: { $ne: section._id } })
      .select("sectionId classroom grid")
      .populate("sectionId", "classroom")
      .lean(),
  ]);
  const subjects = sortedRecords(subjectRecords, "code");
  const teachers = sortedRecords(teacherRecords, "teacherId");
  const existingTimetables = sortedRecords(timetableRecords, "_id");
  const validation = validateEditedTimetable(
    grid,
    subjects,
    teachers,
    roomPool || [],
    {
      classroom: section.classroom,
      existingTimetables,
    }
  );

  return { section, existingTimetables, validation };
}

exports.generatePreview = async (req, res) => {
  try {
    const { sectionId, roomPool } = req.body;
    const workingPeriod = normalizeWorkingPeriod(req.body.workingPeriod);

    if (!sectionId || !workingPeriod) {
      return res.status(400).json({
        error: "sectionId and a valid working date range are required",
      });
    }

    const variationSeed = resolveVariationSeed(req.body.variationSeed);
    const generated = await generateForSection(
      sectionId,
      roomPool,
      variationSeed
    );
    if (!generated) return res.status(404).json({ error: "Section not found" });

    const { section, existingTimetables, result } = generated;
    const timetable = previewTimetable(
      section,
      result.timetable,
      existingTimetables,
      workingPeriod
    );
    timetable.warnings = result.warnings;

    if (!result.success) {
      return res.status(422).json({
        success: false,
        saved: false,
        error: "A complete conflict-free timetable could not be generated.",
        timetable,
        warnings: result.warnings,
        checkedTimetables: existingTimetables.length,
        variationSeed,
      });
    }

    return res.json({
      success: true,
      saved: false,
      timetable,
      warnings: result.warnings,
      checkedTimetables: existingTimetables.length,
      variationSeed,
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

exports.saveGenerated = async (req, res) => {
  try {
    const { sectionId, roomPool, variationSeed, grid } = req.body;
    const workingPeriod = normalizeWorkingPeriod(req.body.workingPeriod);

    if (
      !sectionId ||
      variationSeed === undefined ||
      !isExactGrid(grid) ||
      !workingPeriod
    ) {
      return res.status(400).json({
        error: "sectionId, variationSeed, working dates, and a 6 x 9 preview grid are required",
      });
    }

    const numericSeed = Number(variationSeed);
    if (!Number.isFinite(numericSeed)) {
      return res.status(400).json({ error: "variationSeed must be a number" });
    }

    // Recreate the preview using current MongoDB state. This prevents a stale
    // or client-modified timetable from being persisted after another section
    // has claimed one of its teachers or rooms.
    const generated = await generateForSection(sectionId, roomPool, numericSeed);
    if (!generated) return res.status(404).json({ error: "Section not found" });

    const { section, existingTimetables, result } = generated;
    if (!result.success || !gridsMatch(grid, result.timetable)) {
      return res.status(409).json({
        success: false,
        saved: false,
        regenerateRequired: true,
        error: "The preview is no longer current. Generate the timetable again before saving.",
        warnings: result.warnings,
      });
    }

    const generationContext = {
      constraintVersion: "college-v3-round-robin",
      referencedTimetableIds: existingTimetables
        .map((timetable) => timetable._id)
        .filter(Boolean),
    };
    const saved = await Timetable.findOneAndUpdate(
      { sectionId },
      {
        sectionId,
        departmentId: section.departmentId || null,
        semester: section.semester,
        classroom: section.classroom,
        workingPeriod,
        grid: result.timetable,
        warnings: result.warnings || [],
        generationContext,
        status: "generated",
        generatedAt: new Date(),
      },
      { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true }
    );

    return res.json({
      success: true,
      saved: true,
      timetable: saved,
      warnings: result.warnings,
      checkedTimetables: existingTimetables.length,
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

exports.validateEdited = async (req, res) => {
  try {
    const { sectionId, roomPool, grid } = req.body;
    const workingPeriod = normalizeWorkingPeriod(req.body.workingPeriod);

    if (!sectionId || !isExactGrid(grid) || !workingPeriod) {
      return res.status(400).json({
        success: false,
        error: "sectionId, working dates, and an edited 6 x 9 timetable grid are required",
      });
    }

    const checked = await validateEditedForSection(sectionId, roomPool, grid);
    if (!checked) return res.status(404).json({ error: "Section not found" });

    if (!checked.validation.success) {
      return res.status(422).json({
        success: false,
        error:
          checked.validation.errors[0] ||
          "This drop would make the timetable invalid.",
        errors: checked.validation.errors,
      });
    }

    return res.json({
      success: true,
      checkedTimetables: checked.existingTimetables.length,
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

exports.saveEdited = async (req, res) => {
  try {
    const { sectionId, roomPool, grid } = req.body;
    const workingPeriod = normalizeWorkingPeriod(req.body.workingPeriod);

    if (!sectionId || !isExactGrid(grid) || !workingPeriod) {
      return res.status(400).json({
        error: "sectionId, working dates, and an edited 6 x 9 timetable grid are required",
      });
    }

    const checked = await validateEditedForSection(sectionId, roomPool, grid);
    if (!checked) return res.status(404).json({ error: "Section not found" });

    const { section, existingTimetables, validation } = checked;

    if (!validation.success) {
      return res.status(422).json({
        success: false,
        saved: false,
        error: validation.errors[0] || "The edited timetable is invalid.",
        errors: validation.errors,
      });
    }

    const generationContext = {
      constraintVersion: "college-v3-round-robin-manual-edit",
      referencedTimetableIds: existingTimetables
        .map((timetable) => timetable._id)
        .filter(Boolean),
    };
    const saved = await Timetable.findOneAndUpdate(
      { sectionId },
      {
        sectionId,
        departmentId: section.departmentId || null,
        semester: section.semester,
        classroom: section.classroom,
        workingPeriod,
        grid,
        warnings: [],
        generationContext,
        status: "edited",
        generatedAt: new Date(),
      },
      { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true }
    );

    return res.json({
      success: true,
      saved: true,
      timetable: saved,
      warnings: [],
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
        workingPeriod: tt.workingPeriod,
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
