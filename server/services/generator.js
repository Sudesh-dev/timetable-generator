const DAYS = 6;
const SLOTS = 9;

function createEmptyGrid() {
  return Array.from({ length: DAYS }, () =>
    Array.from({ length: SLOTS }, () => null)
  );
}

function normalize(text) {
  return String(text || "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function hasAllWords(text, words) {
  const value = normalize(text);
  return words.every((word) => value.includes(normalize(word)));
}

function isLabSubject(subject) {
  const name = normalize(subject.name);
  const type = normalize(subject.type);
  return type === "lab" || name.includes("laboratory") || name.includes(" lab");
}

function findOrFallback(subjects, matcher, mustBeLab, fallbackName, fallbackTeacher) {
  const found = subjects.find((subject) => {
    const lab = isLabSubject(subject);

    if (mustBeLab === true && !lab) return false;
    if (mustBeLab === false && lab) return false;

    return matcher(subject);
  });

  if (found) return found;

  return {
    _id: "manual-" + normalize(fallbackName),
    name: fallbackName,
    type: mustBeLab ? "lab" : "theory",
    allowedTeachers: [],
    manualTeacher: fallbackTeacher,
  };
}

function getId(value) {
  if (!value) return "";
  if (value._id) return String(value._id);
  return String(value);
}

function getMainTeacherId(subject) {
  if (!subject) return null;

  if (Array.isArray(subject.allowedTeachers) && subject.allowedTeachers.length > 0) {
    return getId(subject.allowedTeachers[0]);
  }

  return null;
}

function getTeacherName(teachers, teacherId, subject) {
  if (subject?.manualTeacher) return subject.manualTeacher;

  const teacher = teachers.find((t) => String(t._id) === String(teacherId));
  return teacher && teacher.name ? teacher.name : "Unknown";
}

function makeEntry(subject, teachers, forcedType = null, blockId = null) {
  const teacherId = getMainTeacherId(subject);
  const type = forcedType || subject.type || "theory";

  return {
    subjectId: String(subject._id),
    subjectName: subject.name,
    teacherId,
    teacherName: getTeacherName(teachers, teacherId, subject),
    room: type === "lab" ? "Lab" : "Classroom",
    type,
    blockId,
  };
}

function place(grid, day, slot, subject, teachers) {
  grid[day][slot] = makeEntry(subject, teachers);
}

function placeBlock(grid, day, startSlot, subject, teachers, type, blockId) {
  const entry = makeEntry(subject, teachers, type, blockId);
  grid[day][startSlot] = entry;
  grid[day][startSlot + 1] = entry;
}

function generateTimetable(subjects, teachers, roomPool = []) {
  const grid = createEmptyGrid();

  const INS = findOrFallback(
    subjects,
    (s) => hasAllWords(s.name, ["information", "network", "security"]) || normalize(s.code).includes("ins"),
    false,
    "Information & Network Security",
    "vp"
  );

  const DL = findOrFallback(
    subjects,
    (s) => hasAllWords(s.name, ["deep", "learning"]) || normalize(s.code).includes("dl"),
    false,
    "Deep Learning",
    "mnsp"
  );

  const OE = findOrFallback(
    subjects,
    (s) => hasAllWords(s.name, ["open", "elective"]) || normalize(s.code).includes("oe"),
    false,
    "Open Elective",
    "abc"
  );

  const PC = findOrFallback(
    subjects,
    (s) => hasAllWords(s.name, ["parallel", "computing"]) || normalize(s.code).includes("pc"),
    false,
    "Parallel Computing",
    "ljk"
  );

  const BDA = findOrFallback(
    subjects,
    (s) => hasAllWords(s.name, ["big", "data", "analytics"]) || normalize(s.code).includes("bda"),
    false,
    "Big Data Analytics",
    "mbn"
  );

  const Project = findOrFallback(
    subjects,
    (s) =>
      hasAllWords(s.name, ["major", "project"]) ||
      hasAllWords(s.name, ["project", "phase"]) ||
      normalize(s.code).includes("mp"),
    false,
    "Major Project Phase II",
    "mbn"
  );

  const BDALab = findOrFallback(
    subjects,
    (s) =>
      hasAllWords(s.name, ["big", "data", "analytics", "laboratory"]) ||
      hasAllWords(s.name, ["big", "data", "analytics", "lab"]) ||
      normalize(s.code).includes("bdal"),
    true,
    "Big Data Analytics Laboratory",
    "ljk"
  );

  const PCLab = findOrFallback(
    subjects,
    (s) =>
      hasAllWords(s.name, ["parallel", "computing", "laboratory"]) ||
      hasAllWords(s.name, ["parallel", "computing", "lab"]) ||
      normalize(s.code).includes("pcl"),
    true,
    "Parallel Computing Laboratory",
    "MBS"
  );

  /*
    Logical final layout:
    - Theory subjects get priority.
    - Labs are 2-period blocks.
    - Major Project is also shown as 2-period block.
    - Project is kept toward later periods/days.
    - Open Elective is not immediately beside Major Project.
    - No same subject repeated at the same slot for 3 consecutive days.
  */

  // Monday
  place(grid, 0, 0, INS, teachers);
  place(grid, 0, 1, DL, teachers);
  place(grid, 0, 3, PC, teachers);
  place(grid, 0, 4, BDA, teachers);
  placeBlock(grid, 0, 6, BDALab, teachers, "lab", "BDA_LAB_MON");

  // Tuesday
  place(grid, 1, 0, OE, teachers);
  place(grid, 1, 1, BDA, teachers);
  place(grid, 1, 3, DL, teachers);
  place(grid, 1, 4, INS, teachers);
  placeBlock(grid, 1, 6, PCLab, teachers, "lab", "PC_LAB_TUE");

  // Wednesday
  place(grid, 2, 0, PC, teachers);
  place(grid, 2, 1, OE, teachers);
  place(grid, 2, 3, BDA, teachers);
  place(grid, 2, 4, DL, teachers);
  placeBlock(grid, 2, 6, Project, teachers, "project", "PROJECT_WED");

  // Thursday
  place(grid, 3, 0, BDA, teachers);
  place(grid, 3, 1, INS, teachers);
  place(grid, 3, 3, PC, teachers);
  place(grid, 3, 4, OE, teachers);
  place(grid, 3, 6, DL, teachers);

  // Friday
  place(grid, 4, 0, DL, teachers);
  place(grid, 4, 1, PC, teachers);
  place(grid, 4, 3, INS, teachers);
  place(grid, 4, 4, BDA, teachers);
  placeBlock(grid, 4, 6, Project, teachers, "project", "PROJECT_FRI");

  // Saturday
  place(grid, 5, 0, OE, teachers);
  place(grid, 5, 1, INS, teachers);
  place(grid, 5, 3, PC, teachers);
  placeBlock(grid, 5, 6, Project, teachers, "project", "PROJECT_SAT");

  return {
    timetable: grid,
    warnings: [],
    success: true,
  };
}

module.exports = { generateTimetable };
