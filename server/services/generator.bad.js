const DAYS = 6;
const SLOTS = 9;

// 0 = 09:00-09:50
// 1 = 09:50-10:40
// 2 = BREAK
// 3 = 11:00-11:50
// 4 = 11:50-12:40
// 5 = LUNCH
// 6 = 01:20-02:10
// 7 = 02:10-03:00
// 8 = 03:00-03:50

const TEACHING_SLOTS = [0, 1, 3, 4, 6, 7, 8];

function createEmptyGrid() {
  return Array.from({ length: DAYS }, () =>
    Array.from({ length: SLOTS }, () => null)
  );
}

function getId(value) {
  if (!value) return "";
  if (value._id) return String(value._id);
  return String(value);
}

function getTeacherIds(subject) {
  if (Array.isArray(subject.allowedTeachers) && subject.allowedTeachers.length > 0) {
    return subject.allowedTeachers.map(getId);
  }
  return [];
}

function getMainTeacherId(subject) {
  const ids = getTeacherIds(subject);
  return ids.length ? ids[0] : null;
}

function getTeacherName(teachers, teacherId) {
  const teacher = teachers.find((t) => String(t._id) === String(teacherId));
  return teacher && teacher.name ? teacher.name : "Unknown";
}

function isLab(subject) {
  const type = String(subject.type || "").toLowerCase();
  const name = String(subject.name || "").toLowerCase();
  return type === "lab" || name.includes("lab") || name.includes("laboratory");
}

function buildTheoryEntry(subject, teachers) {
  const teacherId = getMainTeacherId(subject);

  return {
    subjectId: String(subject._id),
    subjectName: subject.name,
    teacherId,
    teacherName: getTeacherName(teachers, teacherId),
    room: "Classroom",
    type: "theory",
  };
}

function buildLabEntry(subject, teachers, batch, room, blockId) {
  const teacherId = getMainTeacherId(subject);

  return {
    subjectId: String(subject._id),
    subjectName: subject.name,
    teacherId,
    teacherName: getTeacherName(teachers, teacherId),
    room,
    batch,
    type: "lab",
    blockId,
  };
}

function placePairedLabs(grid, labs, teachers, roomPool) {
  if (labs.length === 0) return;

  const lab1Room = roomPool?.[0]?.name || "Lab 1";
  const lab2Room = roomPool?.[1]?.name || "Lab 2";

  if (labs.length === 1) {
    const singleLab = buildLabEntry(labs[0], teachers, "B1/B2", lab1Room, "LAB_SINGLE_TUE");

    grid[1][6] = singleLab;
    grid[1][7] = singleLab;
    return;
  }

  const labA = labs[0];
  const labB = labs[1];

  // Tuesday afternoon:
  // B1 -> Lab A, B2 -> Lab B
  const tueBlock = [
    buildLabEntry(labA, teachers, "B1", lab1Room, "LAB_PAIR_TUE"),
    buildLabEntry(labB, teachers, "B2", lab2Room, "LAB_PAIR_TUE"),
  ];

  grid[1][6] = tueBlock;
  grid[1][7] = tueBlock;

  // Thursday afternoon:
  // B1 -> Lab B, B2 -> Lab A
  const thuBlock = [
    buildLabEntry(labB, teachers, "B1", lab2Room, "LAB_PAIR_THU"),
    buildLabEntry(labA, teachers, "B2", lab1Room, "LAB_PAIR_THU"),
  ];

  grid[3][6] = thuBlock;
  grid[3][7] = thuBlock;
}

function placeTheoryNoGap(grid, theorySubjects, teachers, warnings) {
  const remaining = theorySubjects.map((subject) => ({
    subject,
    remaining: Number(subject.weeklySlots || 0),
  }));

  // Day by day, left to right.
  // This keeps Monday compact with no random gap.
  for (let day = 0; day < DAYS; day++) {
    const usedToday = new Set();

    for (const slot of TEACHING_SLOTS) {
      if (grid[day][slot] !== null) continue;

      let selected = remaining
        .filter((item) => item.remaining > 0)
        .filter((item) => !usedToday.has(String(item.subject._id)))
        .sort((a, b) => b.remaining - a.remaining)[0];

      // If no unique subject is available for this day, leave it blank.
      // This avoids ugly repeated theory subjects on same day.
      if (!selected) continue;

      grid[day][slot] = buildTheoryEntry(selected.subject, teachers);
      selected.remaining--;
      usedToday.add(String(selected.subject._id));
    }
  }

  remaining.forEach((item) => {
    if (item.remaining > 0) {
      warnings.push(`Could not place ${item.remaining} slots for ${item.subject.name}`);
    }
  });
}

function generateTimetable(subjects, teachers, roomPool = []) {
  const grid = createEmptyGrid();
  const warnings = [];

  const labs = subjects.filter(isLab);
  const theorySubjects = subjects.filter((s) => !isLab(s));

  // Labs first, but only in paired batch style.
  placePairedLabs(grid, labs, teachers, roomPool);

  // Theory normally, no batch labels, no Monday random gaps.
  placeTheoryNoGap(grid, theorySubjects, teachers, warnings);

  return {
    timetable: grid,
    warnings,
    success: true,
  };
}

module.exports = { generateTimetable };
