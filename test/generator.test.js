const test = require("node:test");
const assert = require("node:assert/strict");
const mongoose = require("mongoose");

const Timetable = require("../server/models/Timetable");
const {
  TEACHING_SLOTS,
  generateTimetable,
  normalizeGrid,
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
      const entries = Array.isArray(cell) ? cell : [cell];
      return entries.map((entry) => ({ day: dayIndex, slot, entry }));
    })
  );
}

function teacherSessionsForDay(grid, teacherId, dayIndex) {
  const sessions = [];

  for (let position = 0; position < TEACHING_SLOTS.length; position++) {
    const slot = TEACHING_SLOTS[position];
    const entry = grid[dayIndex][slot];
    if (!entry || String(entry.teacherId) !== String(teacherId)) continue;

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
  const teachers = [teacher("t1"), teacher("t2"), teacher("t3")];
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
