const test = require("node:test");
const assert = require("node:assert/strict");
const mongoose = require("mongoose");

const Timetable = require("../server/models/Timetable");
const Subject = require("../server/models/Subject");
const {
  TEACHING_SLOTS,
  generateTimetable,
  getEntries,
  normalizeGrid,
  validateEditedTimetable,
} = require("../server/services/generator");

function teacher(id, name = id) {
  return { _id: id, name };
}

function subject(id, name, weeklySlots, teacherIds, extra = {}) {
  return {
    _id: id,
    name,
    code: id.toUpperCase(),
    type: "theory",
    weeklySlots,
    allowedTeachers: teacherIds,
    ...extra,
  };
}

function scheduledCells(grid) {
  return grid.flatMap((day, dayIndex) =>
    TEACHING_SLOTS.flatMap((slot) => {
      const cell = day[slot];
      if (!cell) return [];
      const entries = getEntries(cell);
      return entries.map((entry) => ({ day: dayIndex, slot, entry }));
    })
  );
}

function teacherSessionsForDay(grid, teacherId, dayIndex) {
  const sessions = [];

  for (let position = 0; position < TEACHING_SLOTS.length; position++) {
    const slot = TEACHING_SLOTS[position];
    const entry = getEntries(grid[dayIndex][slot]).find(
      (item) => String(item.teacherId) === String(teacherId)
    );
    if (!entry) continue;

    const key = entry.blockId || `theory-${dayIndex}-${slot}`;
    const existing = sessions.find((session) => session.key === key);

    if (existing) {
      existing.end = position;
    } else {
      sessions.push({ key, start: position, end: position });
    }
  }

  return sessions.sort((a, b) => a.start - b.start);
}

function assertNoInternalStudentGaps(grid) {
  grid.forEach((day, dayIndex) => {
    const occupied = TEACHING_SLOTS.map((slot) => day[slot] !== null);
    const firstOccupied = occupied.indexOf(true);
    const lastOccupied = occupied.lastIndexOf(true);
    if (firstOccupied < 0) return;

    assert.equal(
      occupied.slice(firstOccupied, lastOccupied + 1).includes(false),
      false,
      `day ${dayIndex} contains an empty teaching period between classes`
    );
  });
}

test("generates from arbitrary database subjects and exact weekly slots", () => {
  const teachers = [
    teacher("t1", "Ada"),
    teacher("t2", "Grace"),
    teacher("t3", "Edsger"),
    teacher("t4", "Barbara"),
    teacher("t5", "Donald"),
  ];
  const subjects = [
    subject("alg", "Algorithms", 4, ["t1"]),
    subject("db", "Database Systems", 4, ["t2"]),
    subject("os", "Operating Systems", 3, ["t3"]),
    subject("net", "Computer Networks", 3, ["t4"]),
    subject("math", "Discrete Mathematics", 2, ["t5"]),
    subject("db-lab", "Database Laboratory", 2, ["t2"], {
      type: "lab",
      duration: 2,
    }),
  ];

  const result = generateTimetable(
    subjects,
    teachers,
    [{ name: "DB Lab" }],
    { classroom: "C-101" }
  );

  assert.equal(result.success, true, result.warnings.join("\n"));
  assert.deepEqual(result.warnings, []);
  assert.equal(result.timetable.length, 6);
  result.timetable.forEach((day) => assert.equal(day.length, 9));

  const cells = scheduledCells(result.timetable);
  const counts = new Map();
  cells.forEach(({ entry }) => {
    counts.set(entry.subjectId, (counts.get(entry.subjectId) || 0) + 1);
  });

  assert.equal(counts.get("alg"), 4);
  assert.equal(counts.get("db"), 4);
  assert.equal(counts.get("os"), 3);
  assert.equal(counts.get("net"), 3);
  assert.equal(counts.get("math"), 2);
  assert.equal(counts.get("db-lab"), 2);
  assert.equal(cells.some(({ entry }) => entry.subjectName.includes("Information & Network")), false);

  result.timetable.forEach((day) => {
    assert.equal(day[2], null);
    assert.equal(day[5], null);
  });
});

test("enforces subject-per-day and teacher workload/gap constraints", () => {
  const teachers = [
    { ...teacher("t1"), maxSessionsPerDay: 99, requiresGap: false },
    teacher("t2"),
    teacher("t3"),
  ];
  const subjects = [
    subject("a", "A", 5, ["t1"]),
    subject("b", "B", 5, ["t2"]),
    subject("c", "C", 5, ["t3"]),
    subject("d", "D", 3, ["t1"]),
    subject("e", "E", 3, ["t2"]),
  ];

  const result = generateTimetable(subjects, teachers, [], {
    classroom: "C-201",
  });

  assert.equal(result.success, true, result.warnings.join("\n"));

  for (let day = 0; day < 6; day++) {
    const occupied = TEACHING_SLOTS.map(
      (slot) => result.timetable[day][slot] !== null
    );
    const lastOccupied = occupied.lastIndexOf(true);
    assert.equal(
      occupied.slice(0, lastOccupied + 1).includes(false),
      false,
      `day ${day} contains an avoidable student gap`
    );

    const subjectIds = scheduledCells([result.timetable[day]]).map(
      ({ entry }) => entry.subjectId
    );
    assert.equal(new Set(subjectIds).size, subjectIds.length);

    for (const { _id: teacherId } of teachers) {
      const sessions = teacherSessionsForDay(result.timetable, teacherId, day);
      assert.ok(sessions.length <= 3);

      for (let index = 1; index < sessions.length; index++) {
        assert.ok(sessions[index].start - sessions[index - 1].end > 1);
      }
    }
  }
});

test("uses fair round-robin turns when a teacher constraint blocks completion", () => {
  const unavailableSlots = [];
  for (let day = 3; day < 6; day++) {
    TEACHING_SLOTS.forEach((slot) => unavailableSlots.push({ day, slot }));
  }

  const result = generateTimetable(
    [
      subject("round-a", "Round A", 2, ["shared"]),
      subject("round-b", "Round B", 2, ["shared"]),
      subject("round-c", "Round C", 2, ["shared"]),
    ],
    [
      {
        ...teacher("shared"),
        maxSessionsPerDay: 1,
        unavailableSlots,
      },
    ],
    [],
    { classroom: "C-202" }
  );

  assert.equal(result.success, false);
  const counts = new Map();
  scheduledCells(result.timetable).forEach(({ entry }) => {
    counts.set(entry.subjectId, (counts.get(entry.subjectId) || 0) + 1);
  });
  assert.deepEqual(
    ["round-a", "round-b", "round-c"].map((id) => counts.get(id)),
    [1, 1, 1]
  );
  assertNoInternalStudentGaps(result.timetable);
});

test("keeps lab periods continuous and treats a lab block as one session", () => {
  const teachers = [teacher("lab-teacher"), teacher("theory-teacher")];
  const subjects = [
    subject("lab", "Networks Lab", 6, ["lab-teacher"], {
      type: "lab",
      duration: 3,
    }),
    subject("theory", "Networks", 4, ["theory-teacher"]),
  ];

  const result = generateTimetable(
    subjects,
    teachers,
    [{ name: "Networks Laboratory" }],
    { classroom: "C-301" }
  );

  assert.equal(result.success, true, result.warnings.join("\n"));

  const labCells = scheduledCells(result.timetable).filter(
    ({ entry }) => entry.subjectId === "lab"
  );
  assert.equal(labCells.length, 6);

  const blocks = new Map();
  labCells.forEach(({ day, slot, entry }) => {
    if (!blocks.has(entry.blockId)) blocks.set(entry.blockId, { day, slots: [] });
    blocks.get(entry.blockId).slots.push(slot);
  });

  assert.equal(blocks.size, 2);
  blocks.forEach(({ slots }) => {
    assert.deepEqual(slots, [6, 7, 8]);
  });
});

test("avoids teacher and classroom conflicts from other saved sections", () => {
  const existingGrid = Array.from({ length: 6 }, () => Array(9).fill(null));
  existingGrid[0][0] = {
    subjectId: "old-a",
    subjectName: "Existing A",
    teacherId: "t1",
    teacherName: "T1",
    room: "OTHER",
    type: "theory",
  };
  existingGrid[0][3] = {
    subjectId: "old-b",
    subjectName: "Existing B",
    teacherId: "other-teacher",
    teacherName: "Other",
    room: "C-401",
    type: "theory",
  };

  const result = generateTimetable(
    [subject("new", "New Subject", 3, ["t1"])],
    [teacher("t1")],
    [],
    {
      classroom: "C-401",
      existingTimetables: [{ classroom: "OTHER", grid: existingGrid }],
    }
  );

  assert.equal(result.success, true, result.warnings.join("\n"));
  assert.equal(result.timetable[0][0], null);
  assert.equal(result.timetable[0][1], null);
  assert.equal(result.timetable[0][3], null);
});

test("selects one available professor from allowedTeachers and keeps the assignment", () => {
  const existingGrid = Array.from({ length: 6 }, () => Array(9).fill(null));

  for (let day = 0; day < 6; day++) {
    [0, 3, 6].forEach((slot, index) => {
      existingGrid[day][slot] = {
        subjectId: `existing-${day}-${index}`,
        subjectName: "Existing",
        teacherId: "busy",
        teacherName: "Busy Teacher",
        room: "OTHER",
        type: "theory",
      };
    });
  }

  const result = generateTimetable(
    [subject("choice", "Teacher Choice", 4, ["busy", "available"])],
    [teacher("busy"), teacher("available")],
    [],
    {
      classroom: "C-402",
      existingTimetables: [{ classroom: "OTHER", grid: existingGrid }],
    }
  );

  assert.equal(result.success, true, result.warnings.join("\n"));
  const assignedTeachers = new Set(
    scheduledCells(result.timetable).map(({ entry }) => entry.teacherId)
  );
  assert.deepEqual([...assignedTeachers], ["available"]);
});

test("returns useful warnings instead of inventing missing subjects or teachers", () => {
  const result = generateTimetable(
    [subject("orphan", "Unassigned Subject", 4, ["missing-teacher"])],
    [],
    [],
    { classroom: "C-501" }
  );

  assert.equal(result.success, false);
  assert.match(result.warnings.join(" "), /no valid assigned teacher/i);
  assert.equal(scheduledCells(result.timetable).length, 0);
});

test("normalizes old wrapped grids and the model now stores a true 6 x 9 grid", () => {
  const grid = Array.from({ length: 6 }, () => Array(9).fill(null));
  grid[0][0] = { subjectName: "A" };

  assert.deepEqual(normalizeGrid([grid]), grid);

  const document = new Timetable({
    sectionId: new mongoose.Types.ObjectId(),
    semester: 1,
    classroom: "C-601",
    grid,
  });

  assert.equal(document.grid.length, 6);
  assert.equal(document.grid[0].length, 9);
  assert.equal(Array.isArray(document.grid[0][0]), false);
});

test("validates altered grids and rejects edits that create student gaps", () => {
  const teachers = [teacher("edit-t1"), teacher("edit-t2")];
  const subjects = [
    subject("edit-a", "Editable A", 1, ["edit-t1"]),
    subject("edit-b", "Editable B", 1, ["edit-t2"]),
  ];
  const generated = generateTimetable(subjects, teachers, [], {
    classroom: "C-EDIT",
  });

  assert.equal(generated.success, true, generated.warnings.join("\n"));
  const valid = validateEditedTimetable(
    generated.timetable,
    subjects,
    teachers,
    [],
    { classroom: "C-EDIT" }
  );
  assert.equal(valid.success, true, valid.errors.join("\n"));

  const invalidGrid = Array.from({ length: 6 }, () => Array(9).fill(null));
  invalidGrid[0][0] = {
    subjectId: "edit-a",
    subjectName: "Editable A",
    teacherId: "edit-t1",
    teacherName: "edit-t1",
    room: "C-EDIT",
    type: "theory",
    duration: 1,
  };
  invalidGrid[0][3] = {
    subjectId: "edit-b",
    subjectName: "Editable B",
    teacherId: "edit-t2",
    teacherName: "edit-t2",
    room: "C-EDIT",
    type: "theory",
    duration: 1,
  };

  const invalid = validateEditedTimetable(
    invalidGrid,
    subjects,
    teachers,
    [],
    { classroom: "C-EDIT" }
  );
  assert.equal(invalid.success, false);
  assert.match(invalid.errors.join(" "), /empty period between classes/i);
});

test("Mongoose sessionDuration defaults do not turn ordinary subjects into zero-length blocks", () => {
  const modelSubject = new Subject({
    name: "Database Systems",
    code: "DBS",
    type: "theory",
    weeklySlots: 2,
    sectionId: new mongoose.Types.ObjectId(),
    allowedTeachers: [new mongoose.Types.ObjectId()],
  });
  const teacherId = String(modelSubject.allowedTeachers[0]);

  const result = generateTimetable(
    [modelSubject],
    [teacher(teacherId)],
    [],
    { classroom: "CSLH-100" }
  );

  assert.equal(result.success, true, result.warnings.join("\n"));
  assert.equal(scheduledCells(result.timetable).length, 2);
});

test("combines B1 B2 and B3 lab rotations without teacher or room clashes", () => {
  const teachers = [
    teacher("ml-1"),
    teacher("ml-2"),
    teacher("ml-3"),
    teacher("dev-1"),
    teacher("dev-2"),
    teacher("dev-3"),
  ];
  const makeAssignments = (prefix, rooms) =>
    ["B1", "B2", "B3"].map((batch, index) => ({
      batch,
      allowedTeachers: [`${prefix}-${index + 1}`],
      roomOptions: [rooms[index]],
    }));
  const subjects = [
    subject("ml-lab", "Machine Learning Lab", 2, [], {
      type: "lab",
      duration: 2,
      parallelGroup: "sixth-sem-labs",
      batchAssignments: makeAssignments("ml", ["Lab 1", "Lab 2", "Lab 3"]),
    }),
    subject("dev-lab", "DevOps Lab", 2, [], {
      type: "lab",
      duration: 2,
      parallelGroup: "sixth-sem-labs",
      batchAssignments: makeAssignments("dev", ["Lab 4", "Lab 5", "Lab 6"]),
    }),
  ];

  const result = generateTimetable(subjects, teachers, [], {
    classroom: "CSLH-101",
  });

  assert.equal(result.success, true, result.warnings.join("\n"));
  const cells = scheduledCells(result.timetable);
  assert.equal(cells.length, 12);

  const sessions = new Map();
  cells.forEach(({ day, slot, entry }) => {
    const key = entry.blockId;
    if (!sessions.has(key)) sessions.set(key, { day, slots: [], entry });
    sessions.get(key).slots.push(slot);
  });
  assert.equal(sessions.size, 6);
  sessions.forEach(({ slots }) => assert.equal(slots.length, 2));

  const parallelBlocks = new Map();
  result.timetable.forEach((day, dayIndex) => {
    TEACHING_SLOTS.forEach((slot) => {
      const cell = day[slot];
      if (!cell?.parallelSessions) return;
      if (!parallelBlocks.has(cell.blockId)) {
        parallelBlocks.set(cell.blockId, {
          day: dayIndex,
          slots: [],
          sessions: cell.parallelSessions,
        });
      }
      parallelBlocks.get(cell.blockId).slots.push(slot);
    });
  });

  assert.equal(parallelBlocks.size, 3);
  parallelBlocks.forEach(({ slots, sessions: entries }) => {
    assert.equal(slots.length, 2);
    assert.equal(entries.length, 2);
    assert.equal(new Set(entries.map((entry) => entry.batch)).size, 2);
    assert.equal(new Set(entries.map((entry) => entry.teacherId)).size, 2);
    assert.equal(new Set(entries.map((entry) => entry.room)).size, 2);
  });

  for (const subjectId of ["ml-lab", "dev-lab"]) {
    const batches = new Set(
      cells
        .filter(({ entry }) => entry.subjectId === subjectId)
        .map(({ entry }) => entry.batch)
    );
    assert.deepEqual([...batches].sort(), ["B1", "B2", "B3"]);
  }
});

test("uses nested saved parallel labs when checking previous timetable clashes", () => {
  const existingGrid = Array.from({ length: 6 }, () => Array(9).fill(null));
  const parallelSessions = [
    {
      subjectId: "old-ml",
      subjectName: "Existing ML Lab",
      teacherId: "t1",
      teacherName: "T1",
      room: "Lab 1",
      type: "lab",
      blockId: "old-ml-block",
      batch: "B1",
    },
    {
      subjectId: "old-dev",
      subjectName: "Existing DevOps Lab",
      teacherId: "other",
      teacherName: "Other",
      room: "Lab 2",
      type: "lab",
      blockId: "old-dev-block",
      batch: "B2",
    },
  ];
  const composite = {
    subjectName: "Existing ML Lab / Existing DevOps Lab",
    type: "parallel-lab",
    blockId: "existing-parallel",
    parallelSessions,
  };
  existingGrid[0][0] = composite;
  existingGrid[0][1] = composite;

  const result = generateTimetable(
    [
      subject("new-lab", "New Laboratory", 2, ["t1"], {
        type: "lab",
        duration: 2,
        roomOptions: ["Lab 1"],
      }),
    ],
    [teacher("t1")],
    [],
    {
      classroom: "CSLH-102",
      existingTimetables: [{ classroom: "OTHER", grid: existingGrid }],
    }
  );

  assert.equal(result.success, true, result.warnings.join("\n"));
  assert.equal(result.timetable[0][0], null);
  assert.equal(result.timetable[0][1], null);
  assert.equal(result.timetable[0][3], null);
});

test("honors configured teacher availability and fixed multi-period sessions", () => {
  const teachers = [
    {
      ...teacher("project-guide"),
      unavailableSlots: [{ day: 0, slot: 0 }],
    },
  ];
  const subjects = [
    subject("project", "Project Phase I", 2, ["project-guide"], {
      type: "project",
      sessionDuration: 2,
      fixedSlots: [{ day: 2, startSlot: 6 }],
    }),
  ];

  const result = generateTimetable(subjects, teachers, [], {
    classroom: "CSLH-103",
  });

  assert.equal(result.success, true, result.warnings.join("\n"));
  assert.equal(result.timetable[2][6].subjectId, "project");
  assert.equal(result.timetable[2][7].subjectId, "project");
  assert.equal(result.timetable[2][6].blockId, result.timetable[2][7].blockId);
});

test("fails clearly when a locked block conflicts with saved teacher activity", () => {
  const existingGrid = Array.from({ length: 6 }, () => Array(9).fill(null));
  existingGrid[2][6] = {
    subjectId: "existing",
    subjectName: "Existing Section",
    teacherId: "guide",
    teacherName: "Guide",
    room: "OTHER",
    type: "theory",
  };

  const result = generateTimetable(
    [
      subject("locked", "Locked Project", 2, ["guide"], {
        type: "project",
        sessionDuration: 2,
        fixedSlots: [{ day: 2, startSlot: 6 }],
      }),
    ],
    [teacher("guide")],
    [],
    {
      classroom: "CSLH-104",
      existingTimetables: [{ classroom: "OTHER", grid: existingGrid }],
    }
  );

  assert.equal(result.success, false);
  assert.match(result.warnings.join(" "), /Could not place 1 session.*Locked Project/i);
});

test("retry seeds explore another valid placement without relaxing constraints", () => {
  const subjects = [subject("retry", "Retry Subject", 1, ["t1"])];
  const teachers = [teacher("t1")];
  const first = generateTimetable(subjects, teachers, [], {
    classroom: "CSLH-105",
    variationSeed: 101,
  });
  const second = generateTimetable(subjects, teachers, [], {
    classroom: "CSLH-105",
    variationSeed: 202,
  });

  assert.equal(first.success, true);
  assert.equal(second.success, true);

  const firstPlacement = scheduledCells(first.timetable)[0];
  const secondPlacement = scheduledCells(second.timetable)[0];
  assert.notDeepEqual(
    [firstPlacement.day, firstPlacement.slot],
    [secondPlacement.day, secondPlacement.slot]
  );
});

test("builds a college-style week with fixed activities and three-way lab rotations", () => {
  const teacherIds = [
    "theory-1",
    "theory-2",
    "theory-3",
    "theory-4",
    "theory-5",
    "activity-1",
    "activity-2",
    "lab-1",
    "lab-2",
    "lab-3",
  ];
  const batchAssignments = (teacherId, room) =>
    ["B1", "B2", "B3"].map((batch) => ({
      batch,
      allowedTeachers: [teacherId],
      roomOptions: [room],
    }));
  const subjects = [
    subject("theory-a", "Theory A", 4, ["theory-1"]),
    subject("theory-b", "Theory B", 4, ["theory-2"]),
    subject("theory-c", "Theory C", 4, ["theory-3"]),
    subject("theory-d", "Theory D", 4, ["theory-4"]),
    subject("theory-e", "Theory E", 4, ["theory-5"]),
    subject("skill", "Skill Development", 2, ["activity-1"], {
      type: "activity",
      sessionDuration: 2,
      fixedSlots: [{ day: 0, startSlot: 6 }],
    }),
    subject("project", "Project Phase I", 2, ["activity-2"], {
      type: "project",
      sessionDuration: 2,
      fixedSlots: [{ day: 1, startSlot: 6 }],
    }),
    subject("lab-a", "Machine Learning Lab", 2, [], {
      type: "lab",
      duration: 2,
      parallelGroup: "semester-lab-rotation",
      batchAssignments: batchAssignments("lab-1", "Lab 1"),
    }),
    subject("lab-b", "DevOps Lab", 2, [], {
      type: "lab",
      duration: 2,
      parallelGroup: "semester-lab-rotation",
      batchAssignments: batchAssignments("lab-2", "Lab 2"),
    }),
    subject("lab-c", "Web Lab", 2, [], {
      type: "lab",
      duration: 2,
      parallelGroup: "semester-lab-rotation",
      batchAssignments: batchAssignments("lab-3", "Lab 3"),
    }),
  ];

  const result = generateTimetable(
    subjects,
    teacherIds.map((id) => teacher(id)),
    [],
    { classroom: "CSLH-201", variationSeed: 2026 }
  );

  assert.equal(result.success, true, result.warnings.join("\n"));
  const cells = scheduledCells(result.timetable);
  const periodCounts = new Map();
  cells.forEach(({ entry }) => {
    periodCounts.set(
      entry.subjectId,
      (periodCounts.get(entry.subjectId) || 0) + 1
    );
  });

  ["theory-a", "theory-b", "theory-c", "theory-d", "theory-e"].forEach(
    (subjectId) => assert.equal(periodCounts.get(subjectId), 4)
  );
  assert.equal(periodCounts.get("skill"), 2);
  assert.equal(periodCounts.get("project"), 2);
  ["lab-a", "lab-b", "lab-c"].forEach((subjectId) =>
    assert.equal(periodCounts.get(subjectId), 6)
  );

  const parallelBlocks = new Map();
  result.timetable.forEach((day) => {
    TEACHING_SLOTS.forEach((slot) => {
      const cell = day[slot];
      if (cell?.type === "parallel-lab") {
        parallelBlocks.set(cell.blockId, cell.parallelSessions);
      }
    });
  });

  assert.equal(parallelBlocks.size, 3);
  parallelBlocks.forEach((entries) => {
    assert.equal(entries.length, 3);
    assert.equal(new Set(entries.map((entry) => entry.batch)).size, 3);
    assert.equal(new Set(entries.map((entry) => entry.teacherId)).size, 3);
    assert.equal(new Set(entries.map((entry) => entry.room)).size, 3);
  });
  assertNoInternalStudentGaps(result.timetable);

  // Retry ordering may move the rotation, but it must never split a complete
  // three-way B1/B2/B3 lab rotation into extra partial blocks.
  [4, 7, 11, 24].forEach((variationSeed) => {
    const retry = generateTimetable(
      subjects,
      teacherIds.map((id) => teacher(id)),
      [],
      { classroom: "CSLH-201", variationSeed }
    );
    const retryBlocks = new Map();
    retry.timetable.forEach((day) => {
      TEACHING_SLOTS.forEach((slot) => {
        const cell = day[slot];
        if (cell?.type === "parallel-lab") {
          retryBlocks.set(cell.blockId, cell.parallelSessions);
        }
      });
    });

    assert.equal(retry.success, true, retry.warnings.join("\n"));
    assert.equal(retryBlocks.size, 3);
    retryBlocks.forEach((entries) => assert.equal(entries.length, 3));
  });
});
