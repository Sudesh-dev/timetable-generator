const DAYS = 6;
const SLOTS = 9;

// Break and lunch remain empty in the stored grid. These are the seven
// teaching periods rendered by the existing frontend.
const TEACHING_SLOTS = [0, 1, 3, 4, 6, 7, 8];
const MAX_TEACHER_SESSIONS_PER_DAY = 3;
const MAX_SEARCH_NODES = 250000;
const MAX_SEARCH_MILLISECONDS = 1500;
const OPTIMIZATION_NODES_AFTER_FIRST_SOLUTION = 10000;

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
  if (Array.isArray(cell)) return cell.flatMap(getEntries);
  if (Array.isArray(cell.parallelSessions)) {
    return cell.parallelSessions.flatMap(getEntries);
  }
  return [cell];
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

function teacherPolicyMap(teachers) {
  return new Map(
    teachers.map((teacher) => {
      const unavailable = new Set(
        (Array.isArray(teacher.unavailableSlots)
          ? teacher.unavailableSlots
          : []
        )
          .map((item) => `${Number(item?.day)}:${Number(item?.slot)}`)
      );
      const configuredLimit = Number(teacher.maxSessionsPerDay);

      return [
        getId(teacher),
        {
          maxSessionsPerDay:
            Number.isInteger(configuredLimit) && configuredLimit > 0
              ? Math.min(configuredLimit, MAX_TEACHER_SESSIONS_PER_DAY)
              : MAX_TEACHER_SESSIONS_PER_DAY,
          unavailable,
        },
      ];
    })
  );
}

function existingTeacherIds(teachers) {
  return new Set(teachers.map(getId).filter(Boolean));
}

function uniqueStrings(values) {
  return [
    ...new Set(
      (Array.isArray(values) ? values : [])
        .map((value) => normalizeRoomName(value))
        .filter(Boolean)
    ),
  ];
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

function normalizeFixedSlots(value, duration) {
  if (!Array.isArray(value)) return [];

  return value
    .map((item) => ({
      day: Number(item?.day),
      start: Number(item?.startSlot ?? item?.start),
    }))
    .filter(
      ({ day, start }) =>
        Number.isInteger(day) &&
        day >= 0 &&
        day < DAYS &&
        getContinuousStarts(duration).includes(start)
    );
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
    const subjectCode = String(subject.code || "").trim();
    const weeklySlots = Number(subject.weeklySlots);
    const lab = isLab(subject);
    const type = String(subject.type || "theory").toLowerCase();
    const configuredDuration =
      subject.sessionDuration === null ||
      subject.sessionDuration === undefined ||
      subject.sessionDuration === ""
        ? Number.NaN
        : Number(subject.sessionDuration);
    const duration = Number.isInteger(configuredDuration)
      ? configuredDuration
      : lab
        ? Number(subject.duration || 2)
        : 1;
    const subjectTeachers = getAllowedTeacherIds(subject, knownTeachers);
    const subjectRooms = uniqueStrings(subject.roomOptions);
    const parallelGroup = String(subject.parallelGroup || "").trim();
    const configuredFixedSlots = Array.isArray(subject.fixedSlots)
      ? subject.fixedSlots
      : [];
    const fixedSlots = normalizeFixedSlots(configuredFixedSlots, duration);

    if (!Number.isInteger(weeklySlots) || weeklySlots < 1) {
      warnings.push(`${subjectName} has an invalid weeklySlots value.`);
      return;
    }

    if (!Number.isInteger(duration) || duration < 1 || duration > 3) {
      warnings.push(`${subjectName} must have a session duration from 1 to 3 periods.`);
      return;
    }

    if (lab && duration < 2) {
      warnings.push(`${subjectName} must have a lab duration of 2 or 3 periods.`);
      return;
    }

    if (configuredFixedSlots.length !== fixedSlots.length) {
      warnings.push(
        `${subjectName} has an invalid fixed placement or a block that crosses break/lunch.`
      );
      return;
    }

    if (weeklySlots % duration !== 0) {
      warnings.push(
        `${subjectName} requires ${weeklySlots} weekly periods, which is not divisible by its ${duration}-period session duration.`
      );
      return;
    }

    const requestedSessions = weeklySlots / duration;

    if (requestedSessions > DAYS) {
      warnings.push(
        `${subjectName} requires ${requestedSessions} weekly sessions, but the one-session-per-day rule allows at most ${DAYS}.`
      );
      return;
    }

    const rawBatchAssignments = Array.isArray(subject.batchAssignments)
      ? subject.batchAssignments
      : [];
    const assignments = rawBatchAssignments.length
      ? rawBatchAssignments
      : (Array.isArray(subject.batches) ? subject.batches : []).map((batch) => ({
          batch,
        }));
    const variants = lab && assignments.length ? assignments : [null];

    variants.forEach((assignment, batchIndex) => {
      const batch = assignment
        ? String(assignment.batch || "").trim()
        : "";
      const assignmentTeachers = assignment
        ? getAllowedTeacherIds(assignment, knownTeachers)
        : [];
      const allowedTeachers = assignmentTeachers.length
        ? assignmentTeachers
        : subjectTeachers;
      const roomOptions = assignment
        ? uniqueStrings(assignment.roomOptions).concat(subjectRooms)
        : subjectRooms;

      if (assignment && !batch) {
        warnings.push(`${subjectName} has a batch assignment without a batch name.`);
        return;
      }

      if (allowedTeachers.length === 0) {
        warnings.push(
          `${subjectName}${batch ? ` (${batch})` : ""} has no valid assigned teacher.`
        );
        return;
      }

      requirements.push({
        requirementId: `${subjectId}:${batch || "section"}:${batchIndex}`,
        subjectOrder: index,
        batchOrder: batchIndex,
        subjectId,
        subjectName,
        subjectCode,
        type,
        duration,
        sessions: requestedSessions,
        remaining: requestedSessions,
        allowedTeachers,
        assignedTeacherId: null,
        usedDays: new Set(),
        batch,
        parallelGroup: batch ? parallelGroup : "",
        roomOptions: [...new Set(roomOptions)],
        fixedSlots,
      });
    });
  });

  const parallelGroups = new Map();
  requirements.forEach((requirement) => {
    if (!requirement.parallelGroup || !requirement.batch) return;
    if (!parallelGroups.has(requirement.parallelGroup)) {
      parallelGroups.set(requirement.parallelGroup, []);
    }
    parallelGroups.get(requirement.parallelGroup).push(requirement);
  });

  parallelGroups.forEach((groupRequirements) => {
    const subjectIds = [
      ...new Set(
        groupRequirements
          .slice()
          .sort((a, b) => a.subjectOrder - b.subjectOrder)
          .map((requirement) => requirement.subjectId)
      ),
    ];
    const batches = [
      ...new Set(
        groupRequirements
          .slice()
          .sort((a, b) => a.batchOrder - b.batchOrder)
          .map((requirement) => requirement.batch)
      ),
    ];
    const rotationCount = Math.max(subjectIds.length, batches.length);

    groupRequirements.forEach((requirement) => {
      const subjectIndex = subjectIds.indexOf(requirement.subjectId);
      const batchIndex = batches.indexOf(requirement.batch);
      requirement.parallelRotationIndex =
        (subjectIndex + batchIndex) % rotationCount;
    });
  });

  // Interleave subjects before returning to the next batch variant. This
  // prevents a subject with B1/B2/B3 requirements from monopolizing the
  // queue and gives every subject one turn per scheduling round. Parallel
  // rotations are placed first because they have the fewest interchangeable
  // positions and must be packed before ordinary sessions consume them.
  return requirements.sort(
    (a, b) =>
      Number(!a.parallelGroup) - Number(!b.parallelGroup) ||
      a.batchOrder - b.batchOrder ||
      a.subjectOrder - b.subjectOrder ||
      a.requirementId.localeCompare(b.requirementId)
  );
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

function createPlanningState(existingTimetables, teachers, variationSeed = 0) {
  return {
    grid: createEmptyGrid(),
    teacherSlots: new Map(),
    teacherDailySessions: new Map(),
    roomSlots: new Map(),
    subjectDays: new Map(),
    parallelBatchDays: new Map(),
    parallelRotationSlots: new Map(),
    teacherPolicies: teacherPolicyMap(teachers),
    variationSeed: Number(variationSeed) || 0,
    external: createExternalState(existingTimetables),
    placedSessions: [],
  };
}

function seededCandidateRank(seed, ...parts) {
  if (!seed) return 0;
  const value = `${seed}:${parts.join(":")}`;
  let hash = 2166136261;

  for (let index = 0; index < value.length; index++) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return hash >>> 0;
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

function ensureLocalRoom(state, room) {
  const key = roomKey(room);
  if (!key || state.roomSlots.has(key)) return key;

  state.roomSlots.set(
    key,
    Array.from({ length: DAYS }, () => Array(SLOTS).fill(null))
  );
  return key;
}

function subjectAlreadyUsedOnDay(state, subjectId, day) {
  return state.subjectDays.get(subjectId)?.has(day) || false;
}

function parallelBatchKey(requirement) {
  if (!requirement.parallelGroup || !requirement.batch) return "";
  return `${requirement.parallelGroup}:${requirement.batch}`;
}

function parallelBatchAlreadyUsedOnDay(state, requirement, day) {
  const key = parallelBatchKey(requirement);
  return key ? state.parallelBatchDays.get(key)?.has(day) || false : false;
}

function parallelRotationKey(requirement) {
  if (
    !requirement.parallelGroup ||
    !Number.isInteger(requirement.parallelRotationIndex)
  ) {
    return "";
  }

  const occurrence = requirement.sessions - requirement.remaining;
  return `${requirement.parallelGroup}:${requirement.parallelRotationIndex}:${occurrence}`;
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
  const policy = state.teacherPolicies.get(teacherId) || {
    maxSessionsPerDay: MAX_TEACHER_SESSIONS_PER_DAY,
    unavailable: new Set(),
  };

  if (teacherSessionCount(state, teacherId, day) >= policy.maxSessionsPerDay) {
    return false;
  }

  for (let offset = 0; offset < duration; offset++) {
    const slot = start + offset;
    if (policy.unavailable.has(`${day}:${slot}`)) return false;
    if (teacherSlotValue(state, teacherId, day, slot)) return false;
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
  const localRoom = state.roomSlots.get(key);
  for (let offset = 0; offset < duration; offset++) {
    const slot = start + offset;
    if (externalRoom?.[day]?.[slot] || localRoom?.[day]?.[slot]) return false;
  }
  return true;
}

function getPlanningEntries(cell) {
  if (!cell) return [];
  return Array.isArray(cell) ? cell : [cell];
}

function sectionCanTakeBlock(state, requirement, day, start) {
  const duration = requirement.duration;

  for (let offset = 0; offset < duration; offset++) {
    const entries = getPlanningEntries(state.grid[day][start + offset]);
    if (entries.length === 0) continue;
    if (!requirement.parallelGroup || !requirement.batch) return false;

    const compatible = entries.every(
      (entry) =>
        entry.parallelGroup === requirement.parallelGroup &&
        entry.groupBlockId ===
          `parallel-${requirement.parallelGroup}:${day}:${start}:${duration}` &&
        entry.batch !== requirement.batch
    );

    if (!compatible) return false;
  }

  return true;
}

function getCandidateRooms(requirement, classroom, roomPool) {
  if (requirement.roomOptions.length > 0) {
    return requirement.roomOptions;
  }

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
  const first = positions[0] ?? -1;
  const last = positions[positions.length - 1] ?? -1;
  let internalGaps = 0;

  for (let position = first; position <= last; position++) {
    if (!occupied.has(position)) internalGaps++;
  }

  // Gaps are expensive; lower daily load keeps teaching spread across all six
  // days, and the final term pushes unused periods toward the end of each day.
  return internalGaps * 1000 + occupied.size * 20 + last;
}

function gridGapCount(grid) {
  return grid.reduce((total, day) => {
    const occupied = TEACHING_SLOTS.map((slot) => day[slot] !== null);
    const firstOccupied = occupied.indexOf(true);
    const lastOccupied = occupied.lastIndexOf(true);

    if (firstOccupied < 0) return total;

    return (
      total +
      occupied
        .slice(firstOccupied, lastOccupied + 1)
        .filter((isOccupied) => !isOccupied).length
    );
  }, 0);
}

function occupiedPeriodCount(grid) {
  return grid.reduce(
    (total, day) =>
      total + TEACHING_SLOTS.filter((slot) => day[slot] !== null).length,
    0
  );
}

function sectionPlacementIsCompact(state, day, start, duration) {
  const occupied = new Set();
  TEACHING_SLOTS.forEach((slot, position) => {
    if (state.grid[day][slot] !== null) occupied.add(position);
  });

  const target = new Set();
  for (let offset = 0; offset < duration; offset++) {
    target.add(teachingPosition(start + offset));
  }

  // Adding another batch to an existing parallel block does not change the
  // section's occupied period range.
  if ([...target].every((position) => occupied.has(position))) return true;

  const combined = new Set([...occupied, ...target]);
  const positions = [...combined].sort((a, b) => a - b);
  const first = positions[0];
  const last = positions[positions.length - 1];

  for (let position = first; position <= last; position++) {
    if (!combined.has(position)) return false;
  }

  return true;
}

function enumerateCandidates(state, requirement, classroom, roomPool) {
  const starts = getContinuousStarts(requirement.duration);
  const teachers = requirement.assignedTeacherId
    ? [requirement.assignedTeacherId]
    : requirement.allowedTeachers;
  const rooms = getCandidateRooms(requirement, classroom, roomPool);
  const rotationKey = parallelRotationKey(requirement);
  const rotationSlot = rotationKey
    ? state.parallelRotationSlots.get(rotationKey)
    : null;
  const candidates = [];

  for (let day = 0; day < DAYS; day++) {
    if (requirement.usedDays.has(day)) continue;
    if (subjectAlreadyUsedOnDay(state, requirement.subjectId, day)) continue;
    if (parallelBatchAlreadyUsedOnDay(state, requirement, day)) continue;

    for (const start of starts) {
      if (
        rotationSlot &&
        (rotationSlot.day !== day ||
          rotationSlot.start !== start ||
          rotationSlot.duration !== requirement.duration)
      ) {
        continue;
      }

      if (
        requirement.fixedSlots.length > 0 &&
        !requirement.fixedSlots.some(
          (fixed) => fixed.day === day && fixed.start === start
        )
      ) {
        continue;
      }

      if (!sectionCanTakeBlock(state, requirement, day, start)) continue;
      if (!sectionPlacementIsCompact(state, day, start, requirement.duration)) {
        continue;
      }

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
              teacherSessionCount(state, teacherId, day) * 5 -
              (state.grid[day][start] !== null ? 250 : 0),
            rank: seededCandidateRank(
              state.variationSeed,
              requirement.requirementId,
              day,
              start,
              teacherId,
              room
            ),
          });
        }
      }
    }
  }

  return candidates.sort((a, b) => {
    if (a.cost !== b.cost) return a.cost - b.cost;
    if (a.rank !== b.rank) return a.rank - b.rank;
    if (a.day !== b.day) return a.day - b.day;
    if (a.start !== b.start) return a.start - b.start;
    return a.teacherId.localeCompare(b.teacherId);
  });
}

function selectNextRequirement(
  state,
  requirements,
  classroom,
  roomPool,
  roundRobinCursor
) {
  for (let offset = 0; offset < requirements.length; offset++) {
    const index = (roundRobinCursor + offset) % requirements.length;
    const requirement = requirements[index];
    if (requirement.remaining <= 0) continue;

    const candidates = enumerateCandidates(
      state,
      requirement,
      classroom,
      roomPool
    );

    // If this subject cannot satisfy teacher/room/continuity constraints for
    // the current state, skip it for this round and try the next subject.
    if (candidates.length === 0) continue;

    return { requirement, candidates, index };
  }

  return null;
}

function buildEntry(
  requirement,
  teacherId,
  teacherNames,
  room,
  blockId,
  groupBlockId
) {
  return {
    subjectId: requirement.subjectId,
    subjectName: requirement.subjectName,
    subjectCode: requirement.subjectCode,
    teacherId,
    teacherName: teacherNames.get(teacherId) || "Unknown",
    room,
    type: requirement.type,
    blockId: requirement.duration > 1 ? blockId : null,
    groupBlockId,
    duration: requirement.duration,
    batch: requirement.batch || null,
    parallelGroup: requirement.parallelGroup || null,
  };
}

function addPlanningEntry(grid, day, slot, entry) {
  const existing = grid[day][slot];
  if (!existing) {
    grid[day][slot] = [entry];
    return;
  }

  if (Array.isArray(existing)) {
    existing.push(entry);
    return;
  }

  grid[day][slot] = [existing, entry];
}

function removePlanningEntry(grid, day, slot, sessionKey) {
  const remaining = getPlanningEntries(grid[day][slot]).filter(
    (entry) => entry.sessionKey !== sessionKey
  );
  grid[day][slot] = remaining.length ? remaining : null;
}

function placeCandidate(state, requirement, candidate, teacherNames) {
  const previousAssignment = requirement.assignedTeacherId;
  const sessionKey = `${requirement.requirementId}:${candidate.day}:${candidate.start}`;
  const blockId = `block-${sessionKey}`;
  const groupBlockId = requirement.parallelGroup
    ? `parallel-${requirement.parallelGroup}:${candidate.day}:${candidate.start}:${requirement.duration}`
    : null;
  const entry = buildEntry(
    requirement,
    candidate.teacherId,
    teacherNames,
    candidate.room,
    blockId,
    groupBlockId
  );
  entry.sessionKey = sessionKey;

  ensureLocalTeacher(state, candidate.teacherId);
  const room = ensureLocalRoom(state, candidate.room);

  for (let offset = 0; offset < requirement.duration; offset++) {
    const slot = candidate.start + offset;
    addPlanningEntry(state.grid, candidate.day, slot, entry);
    state.teacherSlots.get(candidate.teacherId)[candidate.day][slot] = sessionKey;
    if (room) state.roomSlots.get(room)[candidate.day][slot] = sessionKey;
  }

  state.teacherDailySessions
    .get(candidate.teacherId)[candidate.day]
    .add(sessionKey);
  state.placedSessions.push({ requirement, candidate, sessionKey });
  requirement.assignedTeacherId = candidate.teacherId;
  requirement.usedDays.add(candidate.day);
  if (!state.subjectDays.has(requirement.subjectId)) {
    state.subjectDays.set(requirement.subjectId, new Set());
  }
  state.subjectDays.get(requirement.subjectId).add(candidate.day);
  const batchKey = parallelBatchKey(requirement);
  if (batchKey) {
    if (!state.parallelBatchDays.has(batchKey)) {
      state.parallelBatchDays.set(batchKey, new Set());
    }
    state.parallelBatchDays.get(batchKey).add(candidate.day);
  }
  const rotationKey = parallelRotationKey(requirement);
  if (rotationKey) {
    const rotationSlot = state.parallelRotationSlots.get(rotationKey) || {
      day: candidate.day,
      start: candidate.start,
      duration: requirement.duration,
      count: 0,
    };
    rotationSlot.count++;
    state.parallelRotationSlots.set(rotationKey, rotationSlot);
  }
  requirement.remaining--;

  return { previousAssignment, sessionKey, rotationKey };
}

function removeCandidate(state, requirement, candidate, placement) {
  for (let offset = 0; offset < requirement.duration; offset++) {
    const slot = candidate.start + offset;
    removePlanningEntry(state.grid, candidate.day, slot, placement.sessionKey);
    state.teacherSlots.get(candidate.teacherId)[candidate.day][slot] = null;
    const room = roomKey(candidate.room);
    if (room && state.roomSlots.has(room)) {
      state.roomSlots.get(room)[candidate.day][slot] = null;
    }
  }

  state.teacherDailySessions
    .get(candidate.teacherId)[candidate.day]
    .delete(placement.sessionKey);
  state.placedSessions.pop();
  requirement.usedDays.delete(candidate.day);
  state.subjectDays.get(requirement.subjectId)?.delete(candidate.day);
  const batchKey = parallelBatchKey(requirement);
  if (batchKey) state.parallelBatchDays.get(batchKey)?.delete(candidate.day);
  if (placement.rotationKey) {
    const rotationSlot = state.parallelRotationSlots.get(placement.rotationKey);
    if (rotationSlot) {
      rotationSlot.count--;
      if (rotationSlot.count === 0) {
        state.parallelRotationSlots.delete(placement.rotationKey);
      }
    }
  }
  requirement.remaining++;
  requirement.assignedTeacherId = placement.previousAssignment;
}

function clonePlannerSnapshot(state, requirements) {
  return {
    grid: state.grid.map((day) =>
      day.map((cell) => (Array.isArray(cell) ? cell.slice() : cell))
    ),
    placedCount: state.placedSessions.length,
    gapCount: gridGapCount(state.grid),
    occupiedCount: occupiedPeriodCount(state.grid),
    remainingByRequirement: new Map(
      requirements.map((requirement) => [
        requirement.requirementId,
        requirement.remaining,
      ])
    ),
  };
}

function isBetterSnapshot(candidate, current) {
  if (candidate.placedCount !== current.placedCount) {
    return candidate.placedCount > current.placedCount;
  }
  if (candidate.gapCount !== current.gapCount) {
    return candidate.gapCount < current.gapCount;
  }
  return candidate.occupiedCount < current.occupiedCount;
}

function solve(
  requirements,
  teachers,
  classroom,
  roomPool,
  existingTimetables,
  variationSeed
) {
  const state = createPlanningState(
    existingTimetables,
    teachers,
    variationSeed
  );
  const teacherNames = teacherNameMap(teachers);
  const startedAt = Date.now();
  let nodes = 0;
  let best = clonePlannerSnapshot(state, requirements);
  let complete = false;
  let firstCompleteNode = null;
  let searchLimitReached = false;

  function search(roundRobinCursor = 0) {
    if (requirements.every((requirement) => requirement.remaining === 0)) {
      complete = true;
      const candidate = clonePlannerSnapshot(state, requirements);

      if (isBetterSnapshot(candidate, best)) {
        best = candidate;
      }

      if (firstCompleteNode === null) firstCompleteNode = nodes;

      // Keep searching briefly after the first complete solution. Another
      // round-robin arrangement may use fewer section periods by combining
      // all compatible batch labs into parallel rotations.
      return false;
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

    const next = selectNextRequirement(
      state,
      requirements,
      classroom,
      roomPool,
      roundRobinCursor
    );
    if (!next) return false;

    for (const candidate of next.candidates) {
      const placement = placeCandidate(
        state,
        next.requirement,
        candidate,
        teacherNames
      );

      const candidateSnapshot = clonePlannerSnapshot(state, requirements);
      if (isBetterSnapshot(candidateSnapshot, best)) {
        best = candidateSnapshot;
      }

      const nextCursor = (next.index + 1) % requirements.length;
      if (search(nextCursor)) return true;

      removeCandidate(state, next.requirement, candidate, placement);
    }

    return false;
  }

  search();

  return {
    grid: best.grid,
    complete,
    searchLimitReached,
    remainingByRequirement: best.remainingByRequirement,
  };
}

function publicEntry(entry) {
  if (!entry || typeof entry !== "object") return entry;
  const { sessionKey, ...value } = entry;
  return value;
}

function describeParallelEntry(entry) {
  const batch = entry.batch ? ` (${entry.batch})` : "";
  const room = entry.room ? ` - [${entry.room}]` : "";
  return `${entry.subjectName}${batch}${room}`;
}

function finalizeGrid(grid) {
  return grid.map((day) =>
    day.map((cell) => {
      const entries = getPlanningEntries(cell);
      if (entries.length === 0) return null;
      if (entries.length === 1) return publicEntry(entries[0]);

      const sorted = entries
        .slice()
        .sort((a, b) => String(a.batch || "").localeCompare(String(b.batch || "")));
      const parallelSessions = sorted.map(publicEntry);

      return {
        subjectId: sorted.map((entry) => entry.subjectId).join("+"),
        subjectName: sorted.map(describeParallelEntry).join(" / "),
        subjectCode: sorted.map((entry) => entry.subjectCode).join(" / "),
        teacherId: null,
        teacherName: sorted.map((entry) => entry.teacherName).join(" / "),
        room: sorted.map((entry) => entry.room).join(" / "),
        type: "parallel-lab",
        blockId: sorted[0].groupBlockId,
        groupBlockId: sorted[0].groupBlockId,
        duration: sorted[0].duration,
        parallelGroup: sorted[0].parallelGroup,
        parallelSessions,
      };
    })
  );
}

function validateEditedTimetable(
  grid,
  subjects,
  teachers,
  roomPool = [],
  options = {}
) {
  const errors = [];
  const addError = (message) => errors.push(message);
  const exactGrid =
    Array.isArray(grid) &&
    grid.length === DAYS &&
    grid.every((day) => Array.isArray(day) && day.length === SLOTS);

  if (!exactGrid) {
    return {
      success: false,
      errors: ["The edited timetable must contain exactly 6 days and 9 slots per day."],
    };
  }

  const safeSubjects = Array.isArray(subjects) ? subjects : [];
  const safeTeachers = Array.isArray(teachers) ? teachers : [];
  const safeRoomPool = Array.isArray(roomPool) ? roomPool : [];
  const existingTimetables = Array.isArray(options.existingTimetables)
    ? options.existingTimetables
    : [];
  const classroom = normalizeRoomName(options.classroom, "Classroom");
  const configurationWarnings = [];
  const requirements = buildRequirements(
    safeSubjects,
    safeTeachers,
    configurationWarnings
  );
  configurationWarnings.forEach(addError);

  const requirementMap = new Map();
  requirements.forEach((requirement) => {
    const key = `${requirement.subjectId}:${requirement.batch || "section"}`;
    if (requirementMap.has(key)) {
      addError(
        `${requirement.subjectName}${requirement.batch ? ` (${requirement.batch})` : ""} has duplicate scheduling requirements.`
      );
    }
    requirementMap.set(key, requirement);
  });

  const knownTeachers = existingTeacherIds(safeTeachers);
  const policies = teacherPolicyMap(safeTeachers);
  const external = createExternalState(existingTimetables);
  const periodCounts = new Map();
  const sessions = new Map();
  const teachersByRequirement = new Map();
  const localTeacherSlots = new Map();
  const localTeacherSessions = new Map();
  const localRoomSlots = new Map();

  function ensureTeacherValidationState(teacherId) {
    if (localTeacherSlots.has(teacherId)) return;
    localTeacherSlots.set(
      teacherId,
      Array.from({ length: DAYS }, () => Array(SLOTS).fill(null))
    );
    localTeacherSessions.set(
      teacherId,
      Array.from({ length: DAYS }, () => new Set())
    );
  }

  function ensureRoomValidationState(room) {
    const key = roomKey(room);
    if (!key || localRoomSlots.has(key)) return key;
    localRoomSlots.set(
      key,
      Array.from({ length: DAYS }, () => Array(SLOTS).fill(null))
    );
    return key;
  }

  for (let day = 0; day < DAYS; day++) {
    for (const blockedSlot of [2, 5]) {
      if (getEntries(grid[day][blockedSlot]).length > 0) {
        addError(`Day ${day + 1} contains a class during break or lunch.`);
      }
    }

    for (const slot of TEACHING_SLOTS) {
      const entries = getEntries(grid[day][slot]);
      if (entries.length === 0) continue;

      if (entries.length > 1) {
        const parallelGroup = String(entries[0]?.parallelGroup || "");
        const batches = entries.map((entry) => String(entry?.batch || ""));
        const teacherIds = entries.map((entry) => getId(entry?.teacherId));
        const rooms = entries.map((entry) => roomKey(entry?.room));
        const compatible =
          Boolean(parallelGroup) &&
          entries.every(
            (entry) =>
              String(entry?.parallelGroup || "") === parallelGroup &&
              String(entry?.batch || "")
          ) &&
          new Set(batches).size === batches.length &&
          new Set(teacherIds).size === teacherIds.length &&
          new Set(rooms).size === rooms.length;

        if (!compatible) {
          addError(
            `Day ${day + 1}, slot ${slot + 1} contains incompatible parallel classes.`
          );
        }
      }

      entries.forEach((entry) => {
        if (!entry || typeof entry !== "object") {
          addError(`Day ${day + 1}, slot ${slot + 1} contains invalid class data.`);
          return;
        }

        const subjectId = getId(entry.subjectId);
        const batch = String(entry.batch || "").trim();
        const requirementKey = `${subjectId}:${batch || "section"}`;
        const requirement = requirementMap.get(requirementKey);

        if (!requirement) {
          addError(
            `Day ${day + 1}, slot ${slot + 1} contains an unknown subject or batch.`
          );
          return;
        }

        const teacherId = getId(entry.teacherId);
        if (
          !teacherId ||
          !knownTeachers.has(teacherId) ||
          !requirement.allowedTeachers.includes(teacherId)
        ) {
          addError(
            `${requirement.subjectName}${batch ? ` (${batch})` : ""} has an invalid assigned teacher.`
          );
          return;
        }

        const room = normalizeRoomName(entry.room);
        const allowedRooms = getCandidateRooms(
          requirement,
          classroom,
          safeRoomPool
        ).map(roomKey);
        if (!room || !allowedRooms.includes(roomKey(room))) {
          addError(
            `${requirement.subjectName}${batch ? ` (${batch})` : ""} is assigned to an invalid room.`
          );
        }

        const blockId = String(entry.blockId || "").trim();
        if (requirement.duration > 1 && !blockId) {
          addError(
            `${requirement.subjectName}${batch ? ` (${batch})` : ""} must remain a continuous ${requirement.duration}-period block.`
          );
        }

        const sessionKey =
          requirement.duration > 1 && blockId
            ? `${requirementKey}:${blockId}`
            : `${requirementKey}:${day}:${slot}`;
        const session = sessions.get(sessionKey) || {
          key: sessionKey,
          requirement,
          positions: [],
          teachers: new Set(),
          rooms: new Set(),
        };
        session.positions.push({ day, slot });
        session.teachers.add(teacherId);
        session.rooms.add(roomKey(room));
        sessions.set(sessionKey, session);

        periodCounts.set(
          requirementKey,
          (periodCounts.get(requirementKey) || 0) + 1
        );
        if (!teachersByRequirement.has(requirementKey)) {
          teachersByRequirement.set(requirementKey, new Set());
        }
        teachersByRequirement.get(requirementKey).add(teacherId);

        ensureTeacherValidationState(teacherId);
        const teacherSlots = localTeacherSlots.get(teacherId);
        if (teacherSlots[day][slot]) {
          addError(
            `${requirement.subjectName} double-books a teacher on day ${day + 1}, slot ${slot + 1}.`
          );
        }
        if (external.teacherSlots.get(teacherId)?.[day]?.[slot]) {
          addError(
            `${requirement.subjectName} clashes with the teacher's saved timetable on day ${day + 1}, slot ${slot + 1}.`
          );
        }
        if (policies.get(teacherId)?.unavailable.has(`${day}:${slot}`)) {
          addError(
            `${requirement.subjectName} uses a period when the assigned teacher is unavailable.`
          );
        }
        teacherSlots[day][slot] = sessionKey;
        localTeacherSessions.get(teacherId)[day].add(sessionKey);

        const roomId = ensureRoomValidationState(room);
        if (roomId) {
          if (localRoomSlots.get(roomId)[day][slot]) {
            addError(
              `${room} is assigned to more than one class on day ${day + 1}, slot ${slot + 1}.`
            );
          }
          if (external.roomSlots.get(roomId)?.[day]?.[slot]) {
            addError(
              `${room} clashes with another saved timetable on day ${day + 1}, slot ${slot + 1}.`
            );
          }
          localRoomSlots.get(roomId)[day][slot] = sessionKey;
        }
      });
    }

    const occupied = TEACHING_SLOTS.map((slot) => grid[day][slot] !== null);
    const first = occupied.indexOf(true);
    const last = occupied.lastIndexOf(true);
    if (first >= 0 && occupied.slice(first, last + 1).includes(false)) {
      addError(`Day ${day + 1} contains an empty period between classes.`);
    }
  }

  const subjectDaySessions = new Map();
  const parallelBatchDaySessions = new Map();

  sessions.forEach((session) => {
    const { requirement, positions } = session;
    const requirementKey = `${requirement.subjectId}:${requirement.batch || "section"}`;
    const days = [...new Set(positions.map((position) => position.day))];
    const slots = positions
      .map((position) => position.slot)
      .sort((first, second) => first - second);

    if (
      days.length !== 1 ||
      slots.length !== requirement.duration ||
      !getContinuousStarts(requirement.duration).includes(slots[0]) ||
      slots.some((slot, index) => slot !== slots[0] + index)
    ) {
      addError(
        `${requirement.subjectName}${requirement.batch ? ` (${requirement.batch})` : ""} must remain a continuous ${requirement.duration}-period session.`
      );
      return;
    }

    if (session.teachers.size !== 1 || session.rooms.size !== 1) {
      addError(
        `${requirement.subjectName}${requirement.batch ? ` (${requirement.batch})` : ""} must use one teacher and one room throughout its block.`
      );
    }

    if (
      requirement.fixedSlots.length > 0 &&
      !requirement.fixedSlots.some(
        (fixed) => fixed.day === days[0] && fixed.start === slots[0]
      )
    ) {
      addError(`${requirement.subjectName} was moved away from its fixed slot.`);
    }

    const subjectDayKey = `${requirement.subjectId}:${days[0]}`;
    if (!subjectDaySessions.has(subjectDayKey)) {
      subjectDaySessions.set(subjectDayKey, new Set());
    }
    subjectDaySessions.get(subjectDayKey).add(session.key);

    if (requirement.parallelGroup && requirement.batch) {
      const parallelKey = `${requirement.parallelGroup}:${requirement.batch}:${days[0]}`;
      if (!parallelBatchDaySessions.has(parallelKey)) {
        parallelBatchDaySessions.set(parallelKey, new Set());
      }
      parallelBatchDaySessions.get(parallelKey).add(session.key);
    }

    if (!periodCounts.has(requirementKey)) periodCounts.set(requirementKey, 0);
  });

  requirements.forEach((requirement) => {
    const key = `${requirement.subjectId}:${requirement.batch || "section"}`;
    const expectedPeriods = requirement.sessions * requirement.duration;
    const actualPeriods = periodCounts.get(key) || 0;
    if (actualPeriods !== expectedPeriods) {
      addError(
        `${requirement.subjectName}${requirement.batch ? ` (${requirement.batch})` : ""} requires ${expectedPeriods} weekly periods but the edited timetable contains ${actualPeriods}.`
      );
    }

    if ((teachersByRequirement.get(key)?.size || 0) > 1) {
      addError(
        `${requirement.subjectName}${requirement.batch ? ` (${requirement.batch})` : ""} must keep one assigned teacher for the week.`
      );
    }
  });

  subjectDaySessions.forEach((daySessions, key) => {
    if (daySessions.size > 1) {
      const subjectId = key.split(":")[0];
      const requirement = requirements.find(
        (item) => item.subjectId === subjectId
      );
      addError(
        `${requirement?.subjectName || "A subject"} appears more than once on the same day.`
      );
    }
  });

  parallelBatchDaySessions.forEach((daySessions) => {
    if (daySessions.size > 1) {
      addError("A lab batch has more than one rotation from the same group in a day.");
    }
  });

  localTeacherSlots.forEach((slotsByDay, teacherId) => {
    const policy = policies.get(teacherId) || {
      maxSessionsPerDay: MAX_TEACHER_SESSIONS_PER_DAY,
    };

    for (let day = 0; day < DAYS; day++) {
      const localSessions = localTeacherSessions.get(teacherId)[day];
      const externalSessions = external.teacherDailySessions.get(teacherId)?.[day];
      const totalSessions = localSessions.size + (externalSessions?.size || 0);
      if (totalSessions > policy.maxSessionsPerDay) {
        addError(
          `A teacher exceeds the ${policy.maxSessionsPerDay}-session daily limit on day ${day + 1}.`
        );
      }

      for (let position = 1; position < TEACHING_SLOTS.length; position++) {
        const previousSlot = TEACHING_SLOTS[position - 1];
        const currentSlot = TEACHING_SLOTS[position];
        const previousSession =
          slotsByDay[day][previousSlot] ||
          external.teacherSlots.get(teacherId)?.[day]?.[previousSlot];
        const currentSession =
          slotsByDay[day][currentSlot] ||
          external.teacherSlots.get(teacherId)?.[day]?.[currentSlot];

        if (
          previousSession &&
          currentSession &&
          previousSession !== currentSession
        ) {
          addError(
            `A teacher has consecutive separate classes on day ${day + 1}.`
          );
        }
      }
    }
  });

  return {
    success: errors.length === 0,
    errors: [...new Set(errors)],
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
    requirements.some(
      (requirement) =>
        requirement.type === "lab" && requirement.roomOptions.length === 0
    ) &&
    safeRoomPool.length === 0
  ) {
    warnings.push("No lab rooms were supplied; the fallback room name 'Lab' was used.");
  }

  const result = solve(
    requirements,
    safeTeachers,
    classroom,
    safeRoomPool,
    existingTimetables,
    options.variationSeed
  );

  requirements.forEach((requirement) => {
    const remaining =
      result.remainingByRequirement.get(requirement.requirementId) || 0;
    if (remaining > 0) {
      warnings.push(
        `Could not place ${remaining} session${remaining === 1 ? "" : "s"} for ${requirement.subjectName}${requirement.batch ? ` (${requirement.batch})` : ""} without breaking a timetable constraint.`
      );
    }
  });

  if (result.searchLimitReached && !result.complete) {
    warnings.push("The timetable search limit was reached before a complete solution was found.");
  }

  const compact = gridGapCount(result.grid) === 0;
  if (result.complete && !compact) {
    warnings.push(
      "The generated timetable contains an unused teaching period between classes."
    );
  }

  return {
    timetable: finalizeGrid(result.grid),
    warnings: [...new Set(warnings)],
    success: result.complete && compact && warnings.length === 0,
  };
}

module.exports = {
  DAYS,
  SLOTS,
  TEACHING_SLOTS,
  MAX_TEACHER_SESSIONS_PER_DAY,
  createEmptyGrid,
  getEntries,
  normalizeGrid,
  validateEditedTimetable,
  generateTimetable,
};
