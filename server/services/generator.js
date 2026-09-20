const DAYS = 6;
const SLOTS = 9;

// Break and lunch remain empty in the stored grid. These are the seven
// teaching periods rendered by the existing frontend.
const TEACHING_SLOTS = [0, 1, 3, 4, 6, 7, 8];
const MAX_TEACHER_SESSIONS_PER_DAY = 3;
const MAX_SEARCH_NODES = 250000;
const MAX_SEARCH_MILLISECONDS = 1500;
const OPTIMIZATION_NODES_AFTER_FIRST_SOLUTION = 5000;

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

function normalizeGrid(grid) {
  let value = grid;

  // Older records were saved through a three-dimensional Mongoose schema,
  // which wrapped the intended 6 x 9 grid in one additional array.
  if (
    Array.isArray(value) &&
    value.length === 1 &&
    Array.isArray(value[0]) &&
    value[0].length === DAYS
  ) {
    value = value[0];
  }

  if (!Array.isArray(value)) return createEmptyGrid();

  return Array.from({ length: DAYS }, (_, day) => {
    const sourceDay = Array.isArray(value[day]) ? value[day] : [];
    return Array.from({ length: SLOTS }, (_, slot) => sourceDay[slot] || null);
  });
}

function normalizeRoomName(value, fallback = "") {
  if (typeof value === "string") return value.trim() || fallback;
  if (value && typeof value.name === "string") return value.name.trim() || fallback;
  return fallback;
}

function roomKey(value) {
  return normalizeRoomName(value).toLowerCase();
}

function teacherNameMap(teachers) {
  return new Map(
    teachers.map((teacher) => [getId(teacher), teacher.name || "Unknown"])
  );
}

function existingTeacherIds(teachers) {
  return new Set(teachers.map(getId).filter(Boolean));
}

function getAllowedTeacherIds(subject, knownTeachers) {
  const values = Array.isArray(subject.allowedTeachers)
    ? subject.allowedTeachers
    : [];

  return [...new Set(values.map(getId).filter((id) => knownTeachers.has(id)))];
}

function isLab(subject) {
  return String(subject.type || "").toLowerCase() === "lab";
}

function getContinuousStarts(duration) {
  return TEACHING_SLOTS.filter((start) => {
    for (let offset = 0; offset < duration; offset++) {
      if (!TEACHING_SLOTS.includes(start + offset)) return false;
    }
    return true;
  });
}

function teachingPosition(slot) {
  return TEACHING_SLOTS.indexOf(slot);
}

function previousTeachingSlot(slot) {
  const position = teachingPosition(slot);
  return position > 0 ? TEACHING_SLOTS[position - 1] : null;
}

function nextTeachingSlot(slot) {
  const position = teachingPosition(slot);
  return position >= 0 && position < TEACHING_SLOTS.length - 1
    ? TEACHING_SLOTS[position + 1]
    : null;
}

function buildRequirements(subjects, teachers, warnings) {
  const knownTeachers = existingTeacherIds(teachers);
  const requirements = [];

  subjects.forEach((subject, index) => {
    const subjectId = getId(subject) || `subject-${index}`;
    const subjectName = String(subject.name || subject.code || "Unnamed subject").trim();
    const weeklySlots = Number(subject.weeklySlots);
    const lab = isLab(subject);
    const duration = lab ? Number(subject.duration || 2) : 1;
    const allowedTeachers = getAllowedTeacherIds(subject, knownTeachers);

    if (!Number.isInteger(weeklySlots) || weeklySlots < 1) {
      warnings.push(`${subjectName} has an invalid weeklySlots value.`);
      return;
    }

    if (allowedTeachers.length === 0) {
      warnings.push(`${subjectName} has no valid assigned teacher.`);
      return;
    }

    if (lab && (!Number.isInteger(duration) || duration < 2 || duration > 3)) {
      warnings.push(`${subjectName} must have a lab duration of 2 or 3 periods.`);
      return;
    }

    if (lab && weeklySlots % duration !== 0) {
      warnings.push(
        `${subjectName} requires ${weeklySlots} weekly periods, which is not divisible by its ${duration}-period lab duration.`
      );
    }

    const requestedSessions = lab
      ? Math.floor(weeklySlots / duration)
      : weeklySlots;
    const sessions = Math.min(requestedSessions, DAYS);

    if (requestedSessions > DAYS) {
      warnings.push(
        `${subjectName} requires ${requestedSessions} weekly sessions, but the one-session-per-day rule allows at most ${DAYS}.`
      );
    }

    if (sessions === 0) return;

    requirements.push({
      subjectId,
      subjectName,
      type: lab ? "lab" : String(subject.type || "theory").toLowerCase(),
      duration,
      sessions,
      remaining: sessions,
      allowedTeachers,
      assignedTeacherId: null,
      usedDays: new Set(),
    });
  });

  return requirements;
}

function sessionKeyFromEntry(entry, timetableIndex, day, slot) {
  if (entry.blockId) return `existing:${timetableIndex}:${entry.blockId}`;

  const subjectId = getId(entry.subjectId) || entry.subjectName || "session";
  const type = String(entry.type || "theory").toLowerCase();

  // Old lab records sometimes omitted blockId. Contiguous entries for the
  // same subject are treated as one teaching session for the daily limit.
  if (type === "lab" || type === "project") {
    return `existing:${timetableIndex}:${day}:${subjectId}`;
  }

  return `existing:${timetableIndex}:${day}:${slot}:${subjectId}`;
}

function createExternalState(existingTimetables) {
  const teacherSlots = new Map();
  const teacherDailySessions = new Map();
  const roomSlots = new Map();

  function ensureTeacher(teacherId) {
    if (!teacherSlots.has(teacherId)) {
      teacherSlots.set(
        teacherId,
        Array.from({ length: DAYS }, () => Array(SLOTS).fill(null))
      );
      teacherDailySessions.set(
        teacherId,
        Array.from({ length: DAYS }, () => new Set())
      );
    }
  }

  function ensureRoom(key) {
    if (!roomSlots.has(key)) {
      roomSlots.set(
        key,
        Array.from({ length: DAYS }, () => Array(SLOTS).fill(false))
      );
    }
  }

  existingTimetables.forEach((timetable, timetableIndex) => {
    const grid = normalizeGrid(timetable.grid);
    const sectionClassroom = normalizeRoomName(
      timetable.sectionId?.classroom || timetable.classroom
    );

    for (let day = 0; day < DAYS; day++) {
      for (const slot of TEACHING_SLOTS) {
        getEntries(grid[day][slot]).forEach((entry) => {
          if (!entry || typeof entry !== "object") return;

          const teacherId = getId(entry.teacherId);
          const sessionKey = sessionKeyFromEntry(entry, timetableIndex, day, slot);

          if (teacherId) {
            ensureTeacher(teacherId);
            teacherSlots.get(teacherId)[day][slot] = sessionKey;
            teacherDailySessions.get(teacherId)[day].add(sessionKey);
          }

          const entryRoom = normalizeRoomName(entry.room);
          const resolvedRoom =
            !entryRoom || entryRoom.toLowerCase() === "classroom"
              ? sectionClassroom
              : entryRoom;
          const key = roomKey(resolvedRoom);

          if (key) {
            ensureRoom(key);
            roomSlots.get(key)[day][slot] = true;
          }
        });
      }
    }
  });

  return { teacherSlots, teacherDailySessions, roomSlots };
}

function createPlanningState(existingTimetables) {
  return {
    grid: createEmptyGrid(),
    teacherSlots: new Map(),
    teacherDailySessions: new Map(),
    external: createExternalState(existingTimetables),
    placedSessions: [],
  };
}

function ensureLocalTeacher(state, teacherId) {
  if (!state.teacherSlots.has(teacherId)) {
    state.teacherSlots.set(
      teacherId,
      Array.from({ length: DAYS }, () => Array(SLOTS).fill(null))
    );
    state.teacherDailySessions.set(
      teacherId,
      Array.from({ length: DAYS }, () => new Set())
    );
  }
}

function teacherSessionCount(state, teacherId, day) {
  const local = state.teacherDailySessions.get(teacherId)?.[day]?.size || 0;
  const external =
    state.external.teacherDailySessions.get(teacherId)?.[day]?.size || 0;
  return local + external;
}

function teacherSlotValue(state, teacherId, day, slot) {
  return (
    state.teacherSlots.get(teacherId)?.[day]?.[slot] ||
    state.external.teacherSlots.get(teacherId)?.[day]?.[slot] ||
    null
  );
}

function teacherCanTakeBlock(state, teacherId, day, start, duration) {
  if (teacherSessionCount(state, teacherId, day) >= MAX_TEACHER_SESSIONS_PER_DAY) {
    return false;
  }

  for (let offset = 0; offset < duration; offset++) {
    if (teacherSlotValue(state, teacherId, day, start + offset)) return false;
  }

  // A multi-period lab is one continuous session. Only its outside edges are
  // checked so the teacher can teach the periods inside the lab block.
  const before = previousTeachingSlot(start);
  const after = nextTeachingSlot(start + duration - 1);

  if (before !== null && teacherSlotValue(state, teacherId, day, before)) {
    return false;
  }

  if (after !== null && teacherSlotValue(state, teacherId, day, after)) {
    return false;
  }

  return true;
}

function roomIsFree(state, room, day, start, duration) {
  const key = roomKey(room);
  if (!key) return true;

  const externalRoom = state.external.roomSlots.get(key);
  for (let offset = 0; offset < duration; offset++) {
    if (externalRoom?.[day]?.[start + offset]) return false;
  }
  return true;
}

function sectionSlotsAreFree(state, day, start, duration) {
  for (let offset = 0; offset < duration; offset++) {
    if (state.grid[day][start + offset] !== null) return false;
  }
  return true;
}

function getCandidateRooms(requirement, classroom, roomPool) {
  if (requirement.type !== "lab") return [classroom];

  const rooms = roomPool
    .map((room) => normalizeRoomName(room))
    .filter(Boolean);

  return [...new Set(rooms.length > 0 ? rooms : ["Lab"])];
}

function compactnessCost(grid, day, start, duration) {
  const occupied = new Set();

  TEACHING_SLOTS.forEach((slot, position) => {
    if (grid[day][slot] !== null) occupied.add(position);
  });

  for (let offset = 0; offset < duration; offset++) {
    occupied.add(teachingPosition(start + offset));
  }

  const positions = [...occupied].sort((a, b) => a - b);
  const last = positions[positions.length - 1] ?? -1;
  let internalGaps = 0;

  for (let position = 0; position <= last; position++) {
    if (!occupied.has(position)) internalGaps++;
  }

  // Gaps are expensive; lower daily load keeps teaching spread across all six
  // days, and the final term pushes unused periods toward the end of each day.
  return internalGaps * 1000 + occupied.size * 20 + last;
}

function gridGapCount(grid) {
  return grid.reduce((total, day) => {
    const occupied = TEACHING_SLOTS.map((slot) => day[slot] !== null);
    const lastOccupied = occupied.lastIndexOf(true);

    if (lastOccupied < 0) return total;

    return (
      total +
      occupied
        .slice(0, lastOccupied + 1)
        .filter((isOccupied) => !isOccupied).length
    );
  }, 0);
}

function enumerateCandidates(state, requirement, classroom, roomPool) {
  const starts = getContinuousStarts(requirement.duration);
  const teachers = requirement.assignedTeacherId
    ? [requirement.assignedTeacherId]
    : requirement.allowedTeachers;
  const rooms = getCandidateRooms(requirement, classroom, roomPool);
  const candidates = [];

  for (let day = 0; day < DAYS; day++) {
    if (requirement.usedDays.has(day)) continue;

    for (const start of starts) {
      if (!sectionSlotsAreFree(state, day, start, requirement.duration)) continue;

      for (const teacherId of teachers) {
        if (!teacherCanTakeBlock(state, teacherId, day, start, requirement.duration)) {
          continue;
        }

        for (const room of rooms) {
          if (!roomIsFree(state, room, day, start, requirement.duration)) continue;

          candidates.push({
            day,
            start,
            teacherId,
            room,
            cost:
              compactnessCost(state.grid, day, start, requirement.duration) +
              teacherSessionCount(state, teacherId, day) * 5,
          });
        }
      }
    }
  }

  return candidates.sort((a, b) => {
    if (a.cost !== b.cost) return a.cost - b.cost;
    if (a.day !== b.day) return a.day - b.day;
    if (a.start !== b.start) return a.start - b.start;
    return a.teacherId.localeCompare(b.teacherId);
  });
}

function selectNextRequirement(state, requirements, classroom, roomPool) {
  let best = null;

  for (const requirement of requirements) {
    if (requirement.remaining <= 0) continue;

    const candidates = enumerateCandidates(
      state,
      requirement,
      classroom,
      roomPool
    );

    if (
      !best ||
      candidates.length < best.candidates.length ||
      (candidates.length === best.candidates.length &&
        requirement.duration > best.requirement.duration) ||
      (candidates.length === best.candidates.length &&
        requirement.duration === best.requirement.duration &&
        requirement.remaining > best.requirement.remaining)
    ) {
      best = { requirement, candidates };
    }
  }

  return best;
}

function buildEntry(requirement, teacherId, teacherNames, room, blockId) {
  return {
    subjectId: requirement.subjectId,
    subjectName: requirement.subjectName,
    teacherId,
    teacherName: teacherNames.get(teacherId) || "Unknown",
    room,
    type: requirement.type,
    blockId: requirement.duration > 1 ? blockId : null,
  };
}

function placeCandidate(state, requirement, candidate, teacherNames) {
  const previousAssignment = requirement.assignedTeacherId;
  const sessionKey = `${requirement.subjectId}:${candidate.day}:${candidate.start}`;
  const blockId = `block-${sessionKey}`;
  const entry = buildEntry(
    requirement,
    candidate.teacherId,
    teacherNames,
    candidate.room,
    blockId
  );

  ensureLocalTeacher(state, candidate.teacherId);

  for (let offset = 0; offset < requirement.duration; offset++) {
    const slot = candidate.start + offset;
    state.grid[candidate.day][slot] = entry;
    state.teacherSlots.get(candidate.teacherId)[candidate.day][slot] = sessionKey;
  }

  state.teacherDailySessions
    .get(candidate.teacherId)[candidate.day]
    .add(sessionKey);
  state.placedSessions.push({ requirement, candidate, sessionKey });
  requirement.assignedTeacherId = candidate.teacherId;
  requirement.usedDays.add(candidate.day);
  requirement.remaining--;

  return { previousAssignment, sessionKey };
}

function removeCandidate(state, requirement, candidate, placement) {
  for (let offset = 0; offset < requirement.duration; offset++) {
    const slot = candidate.start + offset;
    state.grid[candidate.day][slot] = null;
    state.teacherSlots.get(candidate.teacherId)[candidate.day][slot] = null;
  }

  state.teacherDailySessions
    .get(candidate.teacherId)[candidate.day]
    .delete(placement.sessionKey);
  state.placedSessions.pop();
  requirement.usedDays.delete(candidate.day);
  requirement.remaining++;
  requirement.assignedTeacherId = placement.previousAssignment;
}

function clonePlannerSnapshot(state, requirements) {
  return {
    grid: state.grid.map((day) => day.slice()),
    placedCount: state.placedSessions.length,
    gapCount: gridGapCount(state.grid),
    remainingBySubject: new Map(
      requirements.map((requirement) => [
        requirement.subjectId,
        requirement.remaining,
      ])
    ),
  };
}

function solve(requirements, teachers, classroom, roomPool, existingTimetables) {
  const state = createPlanningState(existingTimetables);
  const teacherNames = teacherNameMap(teachers);
  const startedAt = Date.now();
  let nodes = 0;
  let best = clonePlannerSnapshot(state, requirements);
  let complete = false;
  let firstCompleteNode = null;
  let searchLimitReached = false;

  function search() {
    if (requirements.every((requirement) => requirement.remaining === 0)) {
      complete = true;
      const candidate = clonePlannerSnapshot(state, requirements);

      if (
        candidate.placedCount > best.placedCount ||
        (candidate.placedCount === best.placedCount &&
          candidate.gapCount < best.gapCount)
      ) {
        best = candidate;
      }

      if (firstCompleteNode === null) firstCompleteNode = nodes;

      // A compact timetable cannot be improved further, so stop searching.
      return candidate.gapCount === 0;
    }

    const optimizationFinished =
      firstCompleteNode !== null &&
      nodes - firstCompleteNode >= OPTIMIZATION_NODES_AFTER_FIRST_SOLUTION;
    const timedOut = Date.now() - startedAt >= MAX_SEARCH_MILLISECONDS;

    if (nodes >= MAX_SEARCH_NODES || timedOut || optimizationFinished) {
      searchLimitReached = !complete && (nodes >= MAX_SEARCH_NODES || timedOut);
      return true;
    }
    nodes++;

    const next = selectNextRequirement(state, requirements, classroom, roomPool);
    if (!next || next.candidates.length === 0) return false;

    for (const candidate of next.candidates) {
      const placement = placeCandidate(
        state,
        next.requirement,
        candidate,
        teacherNames
      );

      const candidateSnapshot = clonePlannerSnapshot(state, requirements);
      if (
        candidateSnapshot.placedCount > best.placedCount ||
        (candidateSnapshot.placedCount === best.placedCount &&
          candidateSnapshot.gapCount < best.gapCount)
      ) {
        best = candidateSnapshot;
      }

      if (search()) return true;

      removeCandidate(state, next.requirement, candidate, placement);
    }

    return false;
  }

  search();

  return {
    grid: best.grid,
    complete,
    searchLimitReached,
    remainingBySubject: best.remainingBySubject,
  };
}

function generateTimetable(subjects, teachers, roomPool = [], options = {}) {
  const warnings = [];
  const safeSubjects = Array.isArray(subjects) ? subjects : [];
  const safeTeachers = Array.isArray(teachers) ? teachers : [];
  const safeRoomPool = Array.isArray(roomPool) ? roomPool : [];
  const existingTimetables = Array.isArray(options.existingTimetables)
    ? options.existingTimetables
    : [];
  const classroom = normalizeRoomName(options.classroom, "Classroom");

  if (safeSubjects.length === 0) {
    return {
      timetable: createEmptyGrid(),
      warnings: ["No subjects are configured for this section."],
      success: false,
    };
  }

  const requirements = buildRequirements(safeSubjects, safeTeachers, warnings);

  if (requirements.length === 0) {
    return {
      timetable: createEmptyGrid(),
      warnings,
      success: false,
    };
  }

  if (
    requirements.some((requirement) => requirement.type === "lab") &&
    safeRoomPool.length === 0
  ) {
    warnings.push("No lab rooms were supplied; the fallback room name 'Lab' was used.");
  }

  const result = solve(
    requirements,
    safeTeachers,
    classroom,
    safeRoomPool,
    existingTimetables
  );

  requirements.forEach((requirement) => {
    const remaining = result.remainingBySubject.get(requirement.subjectId) || 0;
    if (remaining > 0) {
      warnings.push(
        `Could not place ${remaining} session${remaining === 1 ? "" : "s"} for ${requirement.subjectName} without breaking a timetable constraint.`
      );
    }
  });

  if (result.searchLimitReached && !result.complete) {
    warnings.push("The timetable search limit was reached before a complete solution was found.");
  }

  return {
    timetable: result.grid,
    warnings: [...new Set(warnings)],
    success: result.complete && warnings.length === 0,
  };
}

module.exports = {
  DAYS,
  SLOTS,
  TEACHING_SLOTS,
  MAX_TEACHER_SESSIONS_PER_DAY,
  createEmptyGrid,
  normalizeGrid,
  generateTimetable,
};
