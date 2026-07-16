const DAYS = 6;
const SLOTS = 9;

// Slot index mapping:
// 0 = 09:00-09:50
// 1 = 09:50-10:40
// 2 = BREAK
// 3 = 11:00-11:50
// 4 = 11:50-12:40
// 5 = LUNCH
// 6 = 01:20-02:10
// 7 = 02:10-03:00
// 8 = 03:00-03:50

const BREAK_SLOT = 2;
const LUNCH_SLOT = 5;

const TEACHING_SLOTS = [0, 1, 3, 4, 6, 7, 8];
const MORNING_SLOTS = [0, 1, 3, 4];
const AFTERNOON_SLOTS = [6, 7, 8];

const MAX_TEACHER_PERIODS_PER_DAY = 4;

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

function getEntries(cell) {
  if (!cell) return [];
  return Array.isArray(cell) ? cell : [cell];
}

function isTeachingSlot(slot) {
  return TEACHING_SLOTS.includes(slot);
}

function isBreakOrLunch(slot) {
  return slot === BREAK_SLOT || slot === LUNCH_SLOT;
}

function getTeacherName(teachers, teacherId) {
  const teacher = teachers.find((t) => String(t._id) === String(teacherId));
  return teacher && teacher.name ? teacher.name : "Unknown";
}

function getTeacherIds(subject) {
  if (Array.isArray(subject.allowedTeachers) && subject.allowedTeachers.length > 0) {
    return subject.allowedTeachers.map(getId);
  }

  if (subject.teacherId) {
    return [getId(subject.teacherId)];
  }

  if (subject.teacher) {
    return [getId(subject.teacher)];
  }

  return [];
}

function getMainTeacherId(subject) {
  const ids = getTeacherIds(subject);
  return ids.length > 0 ? ids[0] : null;
}

function cellHasTeacher(cell, teacherId) {
  return getEntries(cell).some((entry) => {
    return entry && String(entry.teacherId) === String(teacherId);
  });
}

function cellHasSubject(cell, subjectId) {
  return getEntries(cell).some((entry) => {
    return entry && String(entry.subjectId) === String(subjectId);
  });
}

function subjectExistsOnDay(grid, subjectId, day) {
  for (const slot of TEACHING_SLOTS) {
    if (cellHasSubject(grid[day][slot], subjectId)) {
      return true;
    }
  }

  return false;
}

function teacherCountOnDay(grid, teacherId, day) {
  let count = 0;

  for (const slot of TEACHING_SLOTS) {
    if (cellHasTeacher(grid[day][slot], teacherId)) {
      count++;
    }
  }

  return count;
}

function dayHasLab(grid, day) {
  for (const slot of TEACHING_SLOTS) {
    const entries = getEntries(grid[day][slot]);
    if (entries.some((entry) => entry && entry.type === "lab")) {
      return true;
    }
  }

  return false;
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

function isContinuousTeachingBlock(start, duration) {
  for (let i = 0; i < duration; i++) {
    const slot = start + i;

    if (slot >= SLOTS) return false;
    if (!isTeachingSlot(slot)) return false;
    if (isBreakOrLunch(slot)) return false;
  }

  return true;
}

function areSlotsEmpty(grid, day, start, duration) {
  for (let i = 0; i < duration; i++) {
    if (grid[day][start + i] !== null) {
      return false;
    }
  }

  return true;
}

function isTeacherFreeForBlock(grid, teacherId, day, start, duration) {
  if (!teacherId) return false;

  const currentCount = teacherCountOnDay(grid, teacherId, day);

  if (currentCount + duration > MAX_TEACHER_PERIODS_PER_DAY) {
    return false;
  }

  for (let i = 0; i < duration; i++) {
    if (cellHasTeacher(grid[day][start + i], teacherId)) {
      return false;
    }
  }

  return true;
}

function isTeacherFreeForTheory(grid, teacherId, day, slot) {
  if (!teacherId) return false;

  if (teacherCountOnDay(grid, teacherId, day) >= MAX_TEACHER_PERIODS_PER_DAY) {
    return false;
  }

  if (cellHasTeacher(grid[day][slot], teacherId)) {
    return false;
  }

  return true;
}

function getTheoryRequiredSlots(subject) {
  if (subject.weeklySlots) return Number(subject.weeklySlots);

  // Later we can make exact VTU credit mapping.
  // For now: credits = weekly theory periods.
  if (subject.credits) return Number(subject.credits);

  return 3;
}

function getLabDuration(subject) {
  if (subject.duration) return Number(subject.duration);

  // Your teacher said lab must be continuous 2 hours.
  return 2;
}

function getLabSessions(subject) {
  if (subject.labSessions) return Number(subject.labSessions);

  const duration = getLabDuration(subject);
  const weeklySlots = Number(subject.weeklySlots || duration);

  return Math.max(1, Math.ceil(weeklySlots / duration));
}

function getBatches(subject) {
  if (Array.isArray(subject.batches) && subject.batches.length > 0) {
    return subject.batches;
  }

  if (subject.batchCount) {
    return Array.from({ length: Number(subject.batchCount) }, (_, i) => `B${i + 1}`);
  }

  return ["B1"];
}

function rotateArray(arr, offset) {
  if (arr.length === 0) return arr;

  const start = offset % arr.length;
  return arr.slice(start).concat(arr.slice(0, start));
}

function getDayLoad(grid, day) {
  return TEACHING_SLOTS.filter((slot) => grid[day][slot] !== null).length;
}

function getMorningLoad(grid, day) {
  return MORNING_SLOTS.filter((slot) => grid[day][slot] !== null).length;
}

function previousMorningSlotsFilled(grid, day, slot) {
  if (!MORNING_SLOTS.includes(slot)) {
    return true;
  }

  const index = MORNING_SLOTS.indexOf(slot);

  for (let i = 0; i < index; i++) {
    const previousSlot = MORNING_SLOTS[i];

    if (grid[day][previousSlot] === null) {
      return false;
    }
  }

  return true;
}

function morningIsFull(grid, day) {
  return MORNING_SLOTS.every((slot) => grid[day][slot] !== null);
}

// ---------------- LAB PLACEMENT ----------------

function getPreferredLabStarts(duration) {
  if (duration === 2) {
    // Prefer after lunch.
    // 6-7 = 01:20-03:00
    // 7-8 = 02:10-03:50
    // 0-1 = first two periods
    // 3-4 = before lunch
    return [6, 7, 0, 3];
  }

  if (duration === 3) {
    // Only clean 3-period block after lunch.
    return [6];
  }

  return TEACHING_SLOTS.filter((slot) => isContinuousTeachingBlock(slot, duration));
}

function canPlaceLab(grid, subject, day, start, duration) {
  if (dayHasLab(grid, day)) return false;

  if (subjectExistsOnDay(grid, subject._id, day)) return false;

  if (!isContinuousTeachingBlock(start, duration)) return false;

  if (!areSlotsEmpty(grid, day, start, duration)) return false;

  const teacherPool = getTeacherIds(subject);

  if (teacherPool.length === 0) return false;

  const batches = getBatches(subject);

  for (let i = 0; i < batches.length; i++) {
    const teacherId = teacherPool[i] || teacherPool[0];

    if (!isTeacherFreeForBlock(grid, teacherId, day, start, duration)) {
      return false;
    }
  }

  return true;
}

function placeLab(grid, subject, teachers, roomPool, roundOffset) {
  const duration = getLabDuration(subject);
  const batches = getBatches(subject);
  const teacherPool = getTeacherIds(subject);
  const starts = getPreferredLabStarts(duration);
  const days = rotateArray([0, 1, 2, 3, 4, 5], roundOffset || 0);

  for (const day of days) {
    for (const start of starts) {
      if (!canPlaceLab(grid, subject, day, start, duration)) {
        continue;
      }

      for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
        const teacherId = teacherPool[batchIndex] || teacherPool[0];
        const room = roomPool[batchIndex] || { name: "Lab" };

        const entry = {
          subjectId: subject._id,
          subjectName: subject.name,
          teacherId,
          teacherName: getTeacherName(teachers, teacherId),
          room: room.name || "Lab",
          batch: batches[batchIndex],
          type: "lab",
        };

        for (let i = 0; i < duration; i++) {
          placeInCell(grid, day, start + i, entry);
        }
      }

      return true;
    }
  }

  return false;
}

// ---------------- THEORY PLACEMENT ----------------

function canPlaceTheory(grid, subject, teacherId, day, slot) {
  if (!isTeachingSlot(slot)) return false;

  if (grid[day][slot] !== null) return false;

  if (subjectExistsOnDay(grid, subject._id, day)) return false;

  if (!isTeacherFreeForTheory(grid, teacherId, day, slot)) return false;

  // Important rule:
  // No empty gaps in morning.
  if (!previousMorningSlotsFilled(grid, day, slot)) return false;

  // Do not use afternoon until morning is filled,
  // unless there are no possible morning slots.
  if (AFTERNOON_SLOTS.includes(slot) && !morningIsFull(grid, day)) {
    return false;
  }

  return true;
}

function findBestTheorySlot(grid, subject, teacherId, roundOffset) {
  const days = rotateArray([0, 1, 2, 3, 4, 5], roundOffset || 0);
  const candidates = [];

  for (const day of days) {
    for (const slot of TEACHING_SLOTS) {
      if (!canPlaceTheory(grid, subject, teacherId, day, slot)) {
        continue;
      }

      candidates.push({
        day,
        slot,
        dayLoad: getDayLoad(grid, day),
        morningLoad: getMorningLoad(grid, day),
        slotOrder: TEACHING_SLOTS.indexOf(slot),
      });
    }
  }

  if (candidates.length === 0) {
    return null;
  }

  candidates.sort((a, b) => {
    // Balance across days first.
    if (a.dayLoad !== b.dayLoad) return a.dayLoad - b.dayLoad;

    // Fill morning neatly.
    if (a.morningLoad !== b.morningLoad) return a.morningLoad - b.morningLoad;

    // Earlier slots first.
    return a.slotOrder - b.slotOrder;
  });

  return candidates[0];
}

function placeTheory(grid, subjects, teachers, warnings) {
  const queue = subjects.map((subject) => ({
    subject,
    remaining: getTheoryRequiredSlots(subject),
  }));

  let round = 0;
  let progress = true;

  // Round-robin:
  // ML, CC, BCT, OE, then again ML, CC, BCT, OE...
  // This avoids one subject occupying all early slots.
  while (progress && queue.some((item) => item.remaining > 0)) {
    progress = false;

    for (const item of queue) {
      if (item.remaining <= 0) continue;

      const subject = item.subject;
      const teacherId = getMainTeacherId(subject);

      if (!teacherId) {
        warnings.push(`No teacher assigned for ${subject.name}`);
        item.remaining = 0;
        continue;
      }

      const best = findBestTheorySlot(grid, subject, teacherId, round);

      if (!best) {
        warnings.push(`Could not place all theory slots for ${subject.name}. Remaining: ${item.remaining}`);
        item.remaining = 0;
        continue;
      }

      placeInCell(grid, best.day, best.slot, {
        subjectId: subject._id,
        subjectName: subject.name,
        teacherId,
        teacherName: getTeacherName(teachers, teacherId),
        room: "Classroom",
        type: "theory",
      });

      item.remaining--;
      round++;
      progress = true;
    }
  }
}

// ---------------- MAIN ----------------

function generateTimetable(subjects, teachers, roomPool = []) {
  const grid = createEmptyGrid();
  const warnings = [];

  const labs = subjects.filter((s) => String(s.type).toLowerCase() === "lab");
  const theory = subjects.filter((s) => String(s.type).toLowerCase() !== "lab");

  // Labs first because they have stronger constraints.
  labs.forEach((lab, index) => {
    const sessions = getLabSessions(lab);

    for (let i = 0; i < sessions; i++) {
      const placed = placeLab(grid, lab, teachers, roomPool, index + i);

      if (!placed) {
        warnings.push(`Could not place lab: ${lab.name}`);
      }
    }
  });

  // Then theory using round-robin.
  placeTheory(grid, theory, teachers, warnings);

  return {
    timetable: grid,
    warnings,
    success: warnings.length === 0,
  };
}

module.exports = { generateTimetable };
