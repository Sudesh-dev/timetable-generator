const DAYS = 6;
const SLOTS = 7;

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

function getPrimaryTeacherId(subject) {
  return subject.allowedTeachers?.[0] || null;
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
  if (slot < SLOTS - 1 && cellHasTeacher(grid[day][slot + 1], teacherId)) return false;

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
  if (!grid[day][slot]) {
    grid[day][slot] = entry;
  } else if (Array.isArray(grid[day][slot])) {
    grid[day][slot].push(entry);
  } else {
    grid[day][slot] = [grid[day][slot], entry];
  }
}

// ---------------- THEORY ----------------

function placeTheory(grid, subjects, teachers, warnings) {
  for (let sub of subjects) {
    const teacherId = getPrimaryTeacherId(sub);

    if (!teacherId) {
      warnings.push(`No teacher for ${sub.name}`);
      continue;
    }

    const teacher = teachers.find(t => String(t._id) === String(teacherId));

    let placed = 0;

    for (let day = 0; day < DAYS; day++) {
      if (placed >= sub.weeklySlots) break;

      if (!isSubjectFreeThatDay(grid, sub._id, day)) continue;

      const shuffledSlots = [...Array(SLOTS).keys()]
        .sort(() => Math.random() - 0.5);

      for (let slot of shuffledSlots) {
        if (grid[day][slot] !== null) continue;
        if (!isTeacherFree(grid, teacherId, day, slot)) continue;

        placeInCell(grid, day, slot, {
          subjectId: sub._id,
          subjectName: sub.name,
          teacherId,
          teacherName: teacher ? teacher.name : "Unknown",
          room: "Classroom",
          type: "theory"
        });

        placed++;
        break;
      }
    }

    if (placed < sub.weeklySlots) {
      warnings.push(`Could not place ${sub.name}`);
    }
  }
}

// ---------------- LAB ----------------

function isTeacherFreeForDuration(grid, teacherId, day, start, duration) {
  for (let i = 0; i < duration; i++) {
    if (!isTeacherFree(grid, teacherId, day, start + i)) return false;
  }
  return true;
}

function placeLab(grid, subject, teachers, roomPool, warnings) {
  const duration = subject.duration || 2;
  const batches = subject.batches?.length ? subject.batches : ["B1"];
  const teacherPool = subject.allowedTeachers || [];

  if (teacherPool.length < batches.length) {
    warnings.push(`Not enough teachers for ${subject.name}`);
    return false;
  }

  if (!roomPool || roomPool.length < batches.length) {
    warnings.push(`Not enough rooms for ${subject.name}`);
    return false;
  }

  for (let day = 0; day < DAYS; day++) {

    // ❌ prevent same lab twice in same day
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

      let assigned = [];

      for (let i = 0; i < batches.length; i++) {
        const teacherId = teacherPool[i];

        if (!isTeacherFreeForDuration(grid, teacherId, day, start, duration)) {
          assigned = [];
          break;
        }

        assigned.push(teacherId);
      }

      if (assigned.length !== batches.length) continue;

      // place lab
      for (let i = 0; i < batches.length; i++) {
        const teacherId = assigned[i];
        const teacher = teachers.find(
          t => String(t._id) === String(teacherId)
        );

        const room = roomPool[i];

        const entry = {
          subjectId: subject._id,
          subjectName: subject.name,
          teacherId,
          teacherName: teacher ? teacher.name : "Unknown",
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
  const warnings = [];

  const labs = subjects.filter(s => s.type === "lab");
  const theory = subjects.filter(s => s.type !== "lab");

  // labs first
  for (let lab of labs) {
    let count = 0;

    while (count < lab.weeklySlots) {
      const placed = placeLab(grid, lab, teachers, roomPool, warnings);
      if (!placed) break;
      count++;
    }
  }

  // theory
  placeTheory(grid, theory, teachers, warnings);

  return {
    timetable: grid,
    warnings,
    success: warnings.length === 0
  };
}

module.exports = {
  generateTimetable
};