const DAYS = 6;
const SLOTS = 7;

// create empty grid
function createEmptyGrid() {
  const grid = [];

  for (let d = 0; d < DAYS; d++) {
    const day = [];

    for (let s = 0; s < SLOTS; s++) {
      day.push(null);
    }

    grid.push(day);
  }

  return grid;
}

// count classes for teacher in a day
function getTeacherCountForDay(grid, teacherId, day) {
  let count = 0;

  for (let s = 0; s < SLOTS; s++) {
    const cell = grid[day][s];
    if (!cell) continue;

    const entries = Array.isArray(cell) ? cell : [cell];

    if (entries.some(e => String(e.teacherId) === String(teacherId))) {
      count++;
    }
  }

  return count;
}

// check teacher availability
function isTeacherFree(grid, teacherId, day, slot) {

  // max 3 per day
  if (getTeacherCountForDay(grid, teacherId, day) >= 3) {
    return false;
  }

  // no consecutive slots
  if (
    slot > 0 &&
    grid[day][slot - 1] &&
    JSON.stringify(grid[day][slot - 1]).includes(teacherId)
  ) {
    return false;
  }

  if (
    slot < SLOTS - 1 &&
    grid[day][slot + 1] &&
    JSON.stringify(grid[day][slot + 1]).includes(teacherId)
  ) {
    return false;
  }

  return true;
}

// subject should not repeat in same day
function isSubjectFreeThatDay(grid, subjectId, day) {
  for (let s = 0; s < SLOTS; s++) {
    const cell = grid[day][s];
    if (!cell) continue;

    const entries = Array.isArray(cell) ? cell : [cell];

    if (entries.some(e => String(e.subjectId) === String(subjectId))) {
      return false;
    }
  }

  return true;
}

// place entry in cell
function placeInCell(grid, day, slot, entry) {
  if (grid[day][slot] === null) {
    grid[day][slot] = entry;
  } else if (Array.isArray(grid[day][slot])) {
    grid[day][slot].push(entry);
  } else {
    grid[day][slot] = [grid[day][slot], entry];
  }
}

// place theory subjects
function placeTheory(grid, subjects, teachers) {

  for (let sub of subjects) {

    let placed = 0;

    const teacherId = sub.allowedTeachers[0];
    const teacher = teachers.find(t => String(t._id) === String(teacherId));

    while (placed < sub.weeklySlots) {

      //  shuffle every attempt
      const shuffledSlots = [...Array(SLOTS).keys()].sort(() => Math.random() - 0.5);
      const shuffledDays = [...Array(DAYS).keys()].sort(() => Math.random() - 0.5);

      let placedThisRound = false;

      for (let slot of shuffledSlots) {
        for (let day of shuffledDays) {

          if (grid[day][slot] !== null) continue;

          if (!isSubjectFreeThatDay(grid, sub._id, day)) continue;

          if (!isTeacherFree(grid, teacherId, day, slot)) continue;

          const entry = {
            subjectId: sub._id,
            subjectName: sub.name,
            teacherId,
            teacherName: teacher ? teacher.name : "Unknown",
            room: "Classroom",
            type: "theory"
          };

          placeInCell(grid, day, slot, entry);

          placed++;
          placedThisRound = true;
          break;
        }
        if (placedThisRound) break;
      }

      // safety break (avoid infinite loop)
      if (!placedThisRound) break;
    }
  }
}

// main generator

function canPlaceLab(grid, day, startSlot, duration) {

  for (let i = 0; i < duration; i++) {
    if (grid[day][startSlot + i] !== null) {
      return false;
    }
  }

  return true;
}

function placeLab(grid, subject, teachers, roomPool) {

  const teacherId = subject.allowedTeachers[0];
  const teacher = teachers.find(t => String(t._id) === String(teacherId));

  const duration = subject.duration || 2;

  const batches = subject.batches && subject.batches.length > 0
    ? subject.batches
    : ["B1"];

  for (let day = 0; day < DAYS; day++) {

    if (!isSubjectFreeThatDay(grid, subject._id, day)) continue;

    for (let start = 0; start <= SLOTS - duration; start++) {

      if (!canPlaceLab(grid, day, start, duration)) continue;

      if (!isTeacherFree(grid, teacherId, day, start)) continue;

      // 🔥 check enough rooms
      if (!roomPool || roomPool.length < batches.length) continue;

      // 🔥 assign rooms per batch
      for (let i = 0; i < batches.length; i++) {

        const batch = batches[i];
        const room = roomPool[i]; // assign different room

        const entry = {
          subjectId: subject._id,
          subjectName: subject.name,
          teacherId,
          teacherName: teacher ? teacher.name : "Unknown",
          room: room.name,
          batch,
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

function generateTimetable(subjects, teachers, roomPool = []) {

  const grid = createEmptyGrid();

  const labs = subjects.filter(s => s.type === "lab");
  const theory = subjects.filter(s => s.type === "theory");

  // place labs first
  for (let lab of labs) {
    let count = 0;

    while (count < lab.weeklySlots) {
      const placed = placeLab(grid, lab, teachers, roomPool); // ✅ pass roomPool

      if (!placed) break;

      count++;
    }
  }

  // place theory
  placeTheory(grid, theory, teachers);

  return {
    timetable: grid,
    warnings: []
  };
}


module.exports = {
  createEmptyGrid,
  isTeacherFree,
  isSubjectFreeThatDay,
  placeInCell,
  generateTimetable
};