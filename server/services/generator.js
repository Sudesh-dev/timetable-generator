const DAYS = 6;
const SLOTS = 9;

// create empty grid
function createEmptyGrid() {
  return Array.from({ length: DAYS }, () =>
    Array.from({ length: SLOTS }, () => null)
  );
}

function cellHasTeacher(cell, teacherId) {
  if (!cell) return false;
  const entries = Array.isArray(cell) ? cell : [cell];
  return entries.some(e => e && String(e.teacherId) === String(teacherId));
}

function getTeacherCountForDay(grid, teacherId, day) {
  let count = 0;
  for (let s = 0; s < SLOTS; s++) {
    if (cellHasTeacher(grid[day][s], teacherId)) count++;
  }
  return count;
}

function isTeacherFree(grid, teacherId, day, slot) {
  if (getTeacherCountForDay(grid, teacherId, day) >= 3) return false;
  if (slot > 0 && cellHasTeacher(grid[day][slot - 1], teacherId)) return false;
  return true;
}

function isSubjectFreeThatDay(grid, subjectId, day) {
  for (let s = 0; s < SLOTS; s++) {
    const cell = grid[day][s];
    if (!cell) continue;
    const entries = Array.isArray(cell) ? cell : [cell];
    if (entries.some(e => e && String(e.subjectId) === String(subjectId))) {
      return false;
    }
  }
  return true;
}

function placeInCell(grid, day, slot, entry) {
  if (!grid[day][slot]) grid[day][slot] = entry;
  else if (Array.isArray(grid[day][slot])) grid[day][slot].push(entry);
  else grid[day][slot] = [grid[day][slot], entry];
}

// ---------------- THEORY ----------------
function placeTheory(grid, subjects, teachers) {
  for (let sub of subjects) {
    let placed = 0;
    const teacherId = sub.allowedTeachers?.[0];
    const teacher = teachers.find(t => String(t._id) === String(teacherId));

    while (placed < sub.weeklySlots) {

      const shuffledDays = [...Array(DAYS).keys()].sort(() => Math.random() - 0.5);
      const shuffledSlots = [...Array(SLOTS).keys()].sort(() => Math.random() - 0.5);

      let placedThisRound = false;

      for (let day of shuffledDays) {
        if (!isSubjectFreeThatDay(grid, sub._id, day)) continue;

        for (let slot of shuffledSlots) {
          if (grid[day][slot] !== null) continue;
          if (!isTeacherFree(grid, teacherId, day, slot)) continue;

          placeInCell(grid, day, slot, {
            subjectId: sub._id,
            subjectName: sub.name,
            teacherId,
            teacherName: teacher?.name || "Unknown",
            room: "Classroom",
            type: "theory"
          });

          placed++;
          placedThisRound = true;
          break;
        }

        if (placedThisRound) break;
      }

      if (!placedThisRound) break;
    }
  }
}

// ---------------- LAB ----------------
function placeLab(grid, subject, teachers, roomPool) {

  const duration = subject.duration || 2;
  const batches = subject.batches?.length ? subject.batches : ["B1"];
  const teacherPool = subject.allowedTeachers || [];

  for (let day = 0; day < DAYS; day++) {

    if (!isSubjectFreeThatDay(grid, subject._id, day)) continue;

    for (let start = 0; start <= SLOTS - duration; start++) {

      let canPlace = true;

      for (let i = 0; i < duration; i++) {
        if (grid[day][start + i] !== null) {
          canPlace = false;
          break;
        }
      }

      if (!canPlace) continue;

      for (let i = 0; i < batches.length; i++) {

        const teacherId = teacherPool[i];
        const teacher = teachers.find(t => String(t._id) === String(teacherId));
        const room = roomPool[i] || { name: "Lab" };

        const entry = {
          subjectId: subject._id,
          subjectName: subject.name,
          teacherId,
          teacherName: teacher?.name || "Unknown",
          room: room.name,
          batch: batches[i],
          type: "lab"
        };

        for (let j = 0; j < duration; j++) {
          placeInCell(grid, day, start + j, entry);
        }
      }

      return true;
    }
  }

  return false;
}

// ---------------- MAIN ----------------
function generateTimetable(subjects, teachers, roomPool = []) {
  const grid = createEmptyGrid();

  const labs = subjects.filter(s => s.type === "lab");
  const theory = subjects.filter(s => s.type !== "lab");

  for (let lab of labs) {
    let count = 0;
    while (count < lab.weeklySlots) {
      if (!placeLab(grid, lab, teachers, roomPool)) break;
      count++;
    }
  }

  placeTheory(grid, theory, teachers);

  return {
    timetable: grid,
    warnings: [],
    success: true
  };
}

module.exports = { generateTimetable };