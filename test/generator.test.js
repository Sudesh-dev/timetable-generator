const test = require("node:test");
const assert = require("node:assert/strict");
const {
  MAX_TEACHER_SESSIONS_PER_DAY,
  TEACHING_SLOTS,
  generateTimetable,
} = require("../server/services/generator");
const { normalizeGrid } = require("../server/services/timetableGrid");

const teachers = [
  { _id: "t1", name: "Teacher One" },
  { _id: "t2", name: "Teacher Two" },
  { _id: "t3", name: "Teacher Three" },
];

function subject(id, overrides = {}) {
  return {
    _id: id,
    name: `Subject ${id}`,
    code: id.toUpperCase(),
    type: "theory",
    weeklySlots: 1,
    allowedTeachers: ["t1"],
    ...overrides,
  };
}

function entries(grid) {
  return grid.flat().filter(Boolean);
}

test("uses weeklySlots and schedules a subject at most once per day", () => {
  const result = generateTimetable(
    [subject("math", { weeklySlots: 4 })],
    teachers,
    [],
    { classroom: "C-101" }
  );
  const placed = entries(result.timetable);

  assert.equal(result.success, true);
  assert.equal(placed.length, 4);
  assert.equal(new Set(placed.map((entry) => entry.subjectId)).size, 1);
  result.timetable.forEach((day) => {
    assert.ok(day.filter((entry) => entry?.subjectId === "math").length <= 1);
  });
});

test("returns a warning instead of inventing a missing teacher", () => {
  const result = generateTimetable(
    [subject("orphan", { allowedTeachers: [] })],
    teachers
  );

  assert.equal(result.success, false);
  assert.deepEqual(entries(result.timetable), []);
  assert.match(result.warnings[0], /No teacher assigned/);
});

test("limits every teacher to three separate sessions per day", () => {
  const subjects = Array.from({ length: 12 }, (_, index) => subject(`s${index}`));
  const result = generateTimetable(subjects, teachers, [], { classroom: "C-101" });

  for (const day of result.timetable) {
    const sessions = day.filter((entry) => entry?.teacherId === "t1");
    assert.ok(sessions.length <= MAX_TEACHER_SESSIONS_PER_DAY);
  }
});

test("keeps a teaching-period gap between separate classes for one teacher", () => {
  const subjects = Array.from({ length: 10 }, (_, index) => subject(`gap${index}`));
  const result = generateTimetable(subjects, teachers, [], { classroom: "C-101" });

  result.timetable.forEach((day) => {
    const occupied = new Set(
      TEACHING_SLOTS.filter((slot) => day[slot]?.teacherId === "t1")
    );
    TEACHING_SLOTS.forEach((slot, index) => {
      if (!occupied.has(slot)) return;
      assert.equal(occupied.has(TEACHING_SLOTS[index + 1]), false);
    });
  });
});

test("places labs as continuous blocks with the requested room", () => {
  const result = generateTimetable(
    [subject("lab", { type: "lab", weeklySlots: 4, duration: 2 })],
    teachers,
    [{ name: "Systems Lab" }],
    { classroom: "C-101" }
  );
  const placed = entries(result.timetable);
  const blocks = placed.reduce((map, entry) => {
    const block = map.get(entry.blockId) || [];
    block.push(entry);
    map.set(entry.blockId, block);
    return map;
  }, new Map());

  assert.equal(result.success, true);
  assert.equal(placed.length, 4);
  assert.equal(blocks.size, 2);
  blocks.forEach((block) => {
    assert.equal(block.length, 2);
    assert.ok(block.every((entry) => entry.room === "Systems Lab"));
  });
});

test("avoids teacher and room conflicts from existing section timetables", () => {
  const externalEntry = {
    subjectId: "external",
    subjectName: "External",
    teacherId: "t1",
    teacherName: "Teacher One",
    room: "C-101",
    type: "theory",
  };
  const externalGrid = Array.from({ length: 6 }, () => Array(9).fill(null));
  externalGrid[0][0] = externalEntry;
  const result = generateTimetable(
    [subject("shared")],
    teachers,
    [],
    {
      classroom: "C-101",
      existingTimetables: [
        { _id: "other", classroom: "C-101", grid: externalGrid },
      ],
    }
  );

  assert.equal(result.timetable[0][0], null);
  assert.equal(entries(result.timetable).length, 1);
});

test("normalizes legacy grids with an extra array wrapper", () => {
  const grid = Array.from({ length: 6 }, () => Array(9).fill(null));
  grid[2][3] = { subjectId: "legacy" };

  assert.equal(normalizeGrid([grid]), grid);
  assert.equal(normalizeGrid([[grid]]), grid);
  assert.deepEqual(normalizeGrid([]), []);
});
