const { normalizeGrid, getCellEntries } = require("./timetableGrid");

const DAYS = 6;
const SLOTS = 9;
const TEACHING_SLOTS = [0, 1, 3, 4, 6, 7, 8];
const MAX_TEACHER_SESSIONS_PER_DAY = 3;

function createEmptyGrid() {
  return Array.from({ length: DAYS }, () =>
    Array.from({ length: SLOTS }, () => null)
  );
}

function getId(value) {
  if (!value) return "";
  return String(value._id || value.id || value);
}

function getTeacherIds(subject) {
  if (Array.isArray(subject.allowedTeachers)) {
    return subject.allowedTeachers.map(getId).filter(Boolean);
  }

  return [getId(subject.teacherId || subject.teacher)].filter(Boolean);
}

function getTeacherName(teachers, teacherId, subject) {
  const teacher = teachers.find((item) => getId(item) === teacherId);
  if (teacher?.name) return teacher.name;

  const populatedTeacher = subject.allowedTeachers?.find(
    (item) => getId(item) === teacherId
  );
  return populatedTeacher?.name || "Unknown";
}

function isLab(subject) {
  return String(subject.type || "").toLowerCase() === "lab";
}

function roomName(room) {
  if (typeof room === "string") return room.trim();
  return String(room?.name || "").trim();
}

function normalizeRoomPool(roomPool) {
  const names = (Array.isArray(roomPool) ? roomPool : [])
    .map(roomName)
    .filter(Boolean);
  return [...new Set(names.length > 0 ? names : ["Lab"])];
}

function resolveExistingRoom(entry, timetable) {
  const value = roomName(entry?.room);
  const genericTheoryRoom = !value || value.toLowerCase() === "classroom";

  if (!isLab(entry || {}) && genericTheoryRoom) {
    return roomName(timetable.classroom) || "Classroom";
  }

  return value || roomName(timetable.classroom);
}

function createExternalConstraints(existingTimetables) {
  const teachersAt = Array.from({ length: DAYS }, () =>
    Array.from({ length: SLOTS }, () => new Set())
  );
  const roomsAt = Array.from({ length: DAYS }, () =>
    Array.from({ length: SLOTS }, () => new Set())
  );
  const teacherSessions = Array.from({ length: DAYS }, () => new Map());

  (existingTimetables || []).forEach((timetable, timetableIndex) => {
    const grid = normalizeGrid(timetable.grid);
    const timetableId = getId(timetable) || `existing-${timetableIndex}`;

    grid.forEach((day, dayIndex) => {
      const seenSessions = new Set();

      day.forEach((cell, slotIndex) => {
        getCellEntries(cell).forEach((entry, entryIndex) => {
          const teacherId = getId(entry.teacherId);
          const room = resolveExistingRoom(entry, timetable);

          if (teacherId) teachersAt[dayIndex][slotIndex].add(teacherId);
          if (room) roomsAt[dayIndex][slotIndex].add(room);
          if (!teacherId) return;

          const sessionKey = entry.blockId
            ? `${timetableId}:${teacherId}:${entry.blockId}`
            : `${timetableId}:${teacherId}:${slotIndex}:${entryIndex}`;

          if (!seenSessions.has(sessionKey)) {
            seenSessions.add(sessionKey);
            const sessions = teacherSessions[dayIndex].get(teacherId) || 0;
            teacherSessions[dayIndex].set(teacherId, sessions + 1);
          }
        });
      });
    });
  });

  return { teachersAt, roomsAt, teacherSessions };
}

function currentEntriesAt(grid, day, slot) {
  return getCellEntries(grid[day][slot]);
}

function teacherBusyAt(state, teacherId, day, slot) {
  if (state.external.teachersAt[day][slot].has(teacherId)) return true;
  return currentEntriesAt(state.grid, day, slot).some(
    (entry) => getId(entry.teacherId) === teacherId
  );
}

function roomBusyAt(state, room, day, slot) {
  if (state.external.roomsAt[day][slot].has(room)) return true;
  return currentEntriesAt(state.grid, day, slot).some(
    (entry) => roomName(entry.room) === room
  );
}

function teacherSessionCount(state, teacherId, day) {
  const external = state.external.teacherSessions[day].get(teacherId) || 0;
  const current = state.teacherSessions[day].get(teacherId) || 0;
  return external + current;
}

function adjacentTeachingSlots(slot) {
  const index = TEACHING_SLOTS.indexOf(slot);
  return [TEACHING_SLOTS[index - 1], TEACHING_SLOTS[index + 1]].filter(
    (value) => value !== undefined
  );
}

function teacherHasAdjacentSession(state, teacherId, day, slots) {
  const candidateSlots = new Set(slots);

  return slots.some((slot) =>
    adjacentTeachingSlots(slot).some(
      (adjacent) =>
        !candidateSlots.has(adjacent) && teacherBusyAt(state, teacherId, day, adjacent)
    )
  );
}

function isContinuousBlock(start, duration) {
  const startIndex = TEACHING_SLOTS.indexOf(start);
  if (startIndex < 0) return false;

  const slots = TEACHING_SLOTS.slice(startIndex, startIndex + duration);
  if (slots.length !== duration) return false;

  return slots.every((slot, index) => index === 0 || slot === slots[index - 1] + 1);
}

function blockSlots(start, duration) {
  return Array.from({ length: duration }, (_, index) => start + index);
}

function canPlace(state, subjectState, day, slots, room) {
  if (state.subjectDays.get(subjectState.id)?.has(day)) return false;
  if (
    teacherSessionCount(state, subjectState.teacherId, day) >=
    MAX_TEACHER_SESSIONS_PER_DAY
  ) {
    return false;
  }
  if (teacherHasAdjacentSession(state, subjectState.teacherId, day, slots)) return false;

  return slots.every(
    (slot) =>
      TEACHING_SLOTS.includes(slot) &&
      state.grid[day][slot] === null &&
      !teacherBusyAt(state, subjectState.teacherId, day, slot) &&
      !roomBusyAt(state, room, day, slot)
  );
}

function countDayGaps(grid, day, proposedSlots) {
  const occupied = new Set(proposedSlots);
  TEACHING_SLOTS.forEach((slot) => {
    if (grid[day][slot] !== null) occupied.add(slot);
  });

  const segments = [TEACHING_SLOTS.slice(0, 4), TEACHING_SLOTS.slice(4)];
  return segments.reduce((total, segment) => {
    const indexes = segment
      .map((slot, index) => (occupied.has(slot) ? index : -1))
      .filter((index) => index >= 0);
    if (indexes.length < 2) return total;

    const first = Math.min(...indexes);
    const last = Math.max(...indexes);
    const holes = segment.slice(first, last + 1).filter((slot) => !occupied.has(slot));
    return total + holes.length;
  }, 0);
}

function dayLoad(grid, day) {
  return TEACHING_SLOTS.filter((slot) => grid[day][slot] !== null).length;
}

function candidateScore(state, candidate, task) {
  const gapPenalty = countDayGaps(state.grid, candidate.day, candidate.slots) * 100;
  const loadPenalty = dayLoad(state.grid, candidate.day) * 4;
  const dayRotation = (candidate.day - task.round + DAYS) % DAYS;
  const slotOrder = TEACHING_SLOTS.indexOf(candidate.slots[0]);
  const labPreference =
    task.duration > 1 ? [6, 0, 3, 7].indexOf(candidate.slots[0]) : 0;

  return (
    gapPenalty +
    loadPenalty +
    dayRotation +
    slotOrder +
    Math.max(labPreference, 0)
  );
}

function getCandidates(state, subjectState, task, rooms) {
  const starts =
    task.duration > 1
      ? TEACHING_SLOTS.filter((slot) => isContinuousBlock(slot, task.duration))
      : TEACHING_SLOTS;
  const candidates = [];

  for (let day = 0; day < DAYS; day++) {
    for (const start of starts) {
      const slots = blockSlots(start, task.duration);
      for (const room of rooms) {
        if (!canPlace(state, subjectState, day, slots, room)) continue;
        candidates.push({ day, slots, room });
      }
    }
  }

  return candidates.sort(
    (left, right) =>
      candidateScore(state, left, task) - candidateScore(state, right, task)
  );
}

function placeTask(state, subjectState, task, candidate, teachers) {
  const blockId =
    task.duration > 1
      ? `${subjectState.id}-${candidate.day}-${candidate.slots[0]}-${task.round}`
      : null;
  const entry = {
    subjectId: subjectState.id,
    subjectName: subjectState.subject.name,
    teacherId: subjectState.teacherId,
    teacherName: getTeacherName(
      teachers,
      subjectState.teacherId,
      subjectState.subject
    ),
    room: candidate.room,
    type: isLab(subjectState.subject)
      ? "lab"
      : subjectState.subject.type || "theory",
    blockId,
  };

  candidate.slots.forEach((slot) => {
    state.grid[candidate.day][slot] = { ...entry };
  });

  if (!state.subjectDays.has(subjectState.id)) {
    state.subjectDays.set(subjectState.id, new Set());
  }
  state.subjectDays.get(subjectState.id).add(candidate.day);

  const current =
    state.teacherSessions[candidate.day].get(subjectState.teacherId) || 0;
  state.teacherSessions[candidate.day].set(subjectState.teacherId, current + 1);
}

function prepareSubjects(subjects, warnings) {
  return (subjects || []).flatMap((subject) => {
    const id = getId(subject);
    const weeklySlots = Number(subject.weeklySlots);
    const teacherId = getTeacherIds(subject)[0];

    if (!id || !subject.name) {
      warnings.push("A subject is missing its id or name");
      return [];
    }
    if (!Number.isInteger(weeklySlots) || weeklySlots <= 0) {
      warnings.push(`Invalid weeklySlots for ${subject.name}`);
      return [];
    }
    if (!teacherId) {
      warnings.push(`No teacher assigned for ${subject.name}`);
      return [];
    }

    const duration = isLab(subject) ? Number(subject.duration || 2) : 1;
    if (isLab(subject) && ![2, 3].includes(duration)) {
      warnings.push(
        `${subject.name} must use a continuous 2- or 3-period lab block`
      );
      return [];
    }
    if (weeklySlots % duration !== 0) {
      warnings.push(
        `${subject.name} weeklySlots must be divisible by its ${duration}-period duration`
      );
      return [];
    }

    return [{ id, subject, teacherId, weeklySlots, duration }];
  });
}

function buildTasks(subjectStates) {
  const tasks = [];
  const ordered = [...subjectStates].sort(
    (left, right) => right.duration - left.duration
  );
  const remaining = new Map(
    ordered.map((item) => [item.id, item.weeklySlots / item.duration])
  );
  let round = 0;

  while ([...remaining.values()].some((value) => value > 0)) {
    ordered.forEach((subjectState) => {
      const count = remaining.get(subjectState.id);
      if (count <= 0) return;
      tasks.push({ subjectState, duration: subjectState.duration, round });
      remaining.set(subjectState.id, count - 1);
    });
    round++;
  }

  return tasks;
}

function generateTimetable(subjects, teachers, roomPool = [], context = {}) {
  const warnings = [];
  const subjectStates = prepareSubjects(subjects, warnings);
  const labRooms = normalizeRoomPool(roomPool);
  const classroom = roomName(context.classroom) || "Classroom";
  const state = {
    grid: createEmptyGrid(),
    external: createExternalConstraints(context.existingTimetables || []),
    subjectDays: new Map(),
    teacherSessions: Array.from({ length: DAYS }, () => new Map()),
  };
  const unplaced = new Map();

  buildTasks(subjectStates).forEach((task) => {
    const rooms = task.duration > 1 ? labRooms : [classroom];
    const candidate = getCandidates(state, task.subjectState, task, rooms)[0];

    if (!candidate) {
      const current = unplaced.get(task.subjectState.id) || 0;
      unplaced.set(task.subjectState.id, current + task.duration);
      return;
    }

    placeTask(state, task.subjectState, task, candidate, teachers || []);
  });

  subjectStates.forEach((subjectState) => {
    const remaining = unplaced.get(subjectState.id) || 0;
    if (remaining > 0) {
      warnings.push(
        `Could not place ${remaining} weekly slot(s) for ${subjectState.subject.name}`
      );
    }
  });

  return {
    timetable: state.grid,
    warnings,
    success: warnings.length === 0,
  };
}

module.exports = {
  DAYS,
  SLOTS,
  TEACHING_SLOTS,
  MAX_TEACHER_SESSIONS_PER_DAY,
  generateTimetable,
};
