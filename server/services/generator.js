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

function cellHasTeacher(cell, teacherId) {
  if (!cell) return false;

  const entries = Array.isArray(cell) ? cell : [cell];
  return entries.some((entry) => String(entry.teacherId) === String(teacherId));
}

function getPrimaryTeacherId(subject) {
  if (!Array.isArray(subject.allowedTeachers) || subject.allowedTeachers.length === 0) {
    return null;
  }

  return subject.allowedTeachers[0];
}

// count classes for teacher in a day
function getTeacherCountForDay(grid, teacherId, day) {
  let count = 0;

  for (let s = 0; s < SLOTS; s++) {
    const cell = grid[day][s];
    if (!cell) continue;

    if (cellHasTeacher(cell, teacherId)) {
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
    cellHasTeacher(grid[day][slot - 1], teacherId)
  ) {
    return false;
  }

  if (
    slot < SLOTS - 1 &&
    grid[day][slot + 1] &&
    cellHasTeacher(grid[day][slot + 1], teacherId)
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
function placeTheory(grid, subjects, teachers, warnings) {

  for (let sub of subjects) {

    let placed = 0;

    const teacherId = getPrimaryTeacherId(sub);
    if (!teacherId) {
      warnings.push(`No allowed teacher assigned for theory subject ${sub.name}`);
      continue;
    }

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

    if (placed < sub.weeklySlots) {
      warnings.push(
        `Could not fully place theory subject ${sub.name} (${placed}/${sub.weeklySlots})`
      );
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

function placeLab(grid, subject, teacherId, teachers, roomPool) {
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
  const warnings = [];

  const labs = subjects.filter(s => s.type === "lab");
  const theory = subjects.filter(s => s.type === "theory" || s.type === "tutorial");

  const unsupported = subjects.filter(
    (s) => s.type !== "lab" && s.type !== "theory" && s.type !== "tutorial"
  );

  for (const sub of unsupported) {
    warnings.push(`Unsupported subject type ${sub.type} for ${sub.name}`);
  }

  // place labs first
  for (let lab of labs) {
    const teacherId = getPrimaryTeacherId(lab);
    if (!teacherId) {
      warnings.push(`No allowed teacher assigned for lab subject ${lab.name}`);
      continue;
    }

    const batches = lab.batches && lab.batches.length > 0 ? lab.batches : ["B1"];
    if (!roomPool || roomPool.length < batches.length) {
      warnings.push(
        `Not enough lab rooms for ${lab.name}: need ${batches.length}, got ${roomPool ? roomPool.length : 0}`
      );
      continue;
    }

    let count = 0;

    while (count < lab.weeklySlots) {
      const placed = placeLab(grid, lab, teacherId, teachers, roomPool);

      if (!placed) break;

      count++;
    }

    if (count < lab.weeklySlots) {
      warnings.push(
        `Could not fully place lab subject ${lab.name} (${count}/${lab.weeklySlots})`
      );
    }
  }

  // place theory
  placeTheory(grid, theory, teachers, warnings);

  return {
    timetable: grid,
    warnings,
    success: warnings.length === 0
  };
}


module.exports = {
  createEmptyGrid,
  isTeacherFree,
  isSubjectFreeThatDay,
  placeInCell,
  generateTimetable
};