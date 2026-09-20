const test = require("node:test");
const assert = require("node:assert/strict");

const Section = require("../server/models/Section");
const Subject = require("../server/models/Subject");
const Teacher = require("../server/models/Teacher");
const Timetable = require("../server/models/Timetable");
const controller = require("../server/controllers/timetableController");

function responseRecorder() {
  return {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(value) {
      this.body = value;
      return this;
    },
  };
}

function installGenerationStubs({ subjects, teachers, existingTimetables = [] }) {
  const originals = {
    findSection: Section.findById,
    findSubjects: Subject.find,
    findTeachers: Teacher.find,
    findTimetables: Timetable.find,
    updateTimetable: Timetable.findOneAndUpdate,
  };
  let updateCalls = 0;
  let lastUpdate = null;

  Section.findById = async () => ({
    _id: "section-1",
    semester: 3,
    classroom: "CSLH-001",
    departmentId: null,
  });
  Subject.find = async () => subjects;
  Teacher.find = async () => teachers;
  Timetable.find = () => ({
    select() {
      return this;
    },
    populate() {
      return this;
    },
    async lean() {
      return existingTimetables;
    },
  });
  Timetable.findOneAndUpdate = async (filter, update) => {
    updateCalls++;
    lastUpdate = { filter, update };
    return { _id: "saved-timetable", ...update };
  };

  return {
    get updateCalls() {
      return updateCalls;
    },
    get lastUpdate() {
      return lastUpdate;
    },
    restore() {
      Section.findById = originals.findSection;
      Subject.find = originals.findSubjects;
      Teacher.find = originals.findTeachers;
      Timetable.find = originals.findTimetables;
      Timetable.findOneAndUpdate = originals.updateTimetable;
    },
  };
}

test("failed preview generation reports warnings without writing to MongoDB", async () => {
  const stubs = installGenerationStubs({
    subjects: [
      {
        _id: "orphan-subject",
        name: "Unassigned Subject",
        code: "ORPHAN",
        type: "theory",
        weeklySlots: 4,
        allowedTeachers: ["missing-teacher"],
      },
    ],
    teachers: [],
    existingTimetables: [
      {
        _id: "existing-timetable",
        sectionId: { _id: "section-2", classroom: "CSLH-002" },
        classroom: "CSLH-002",
        grid: [],
      },
    ],
  });

  try {
    const req = {
      body: {
        sectionId: "section-1",
        roomPool: [{ name: "Lab 1" }],
      },
    };
    const res = responseRecorder();

    await controller.generatePreview(req, res);

    assert.equal(res.statusCode, 422);
    assert.equal(res.body.success, false);
    assert.equal(res.body.saved, false);
    assert.equal(res.body.checkedTimetables, 1);
    assert.match(res.body.warnings.join(" "), /no valid assigned teacher/i);
    assert.equal(stubs.updateCalls, 0);
  } finally {
    stubs.restore();
  }
});

test("generation stays unsaved until the explicit save endpoint is called", async () => {
  const stubs = installGenerationStubs({
    subjects: [
      {
        _id: "algorithms",
        name: "Algorithms",
        code: "ALG",
        type: "theory",
        weeklySlots: 1,
        allowedTeachers: ["teacher-1"],
      },
    ],
    teachers: [{ _id: "teacher-1", name: "Teacher One" }],
  });

  try {
    const roomPool = [{ name: "Lab 1" }];
    const previewResponse = responseRecorder();
    await controller.generatePreview(
      {
        body: {
          sectionId: "section-1",
          roomPool,
          variationSeed: 12345,
        },
      },
      previewResponse
    );

    assert.equal(previewResponse.statusCode, 200);
    assert.equal(previewResponse.body.success, true);
    assert.equal(previewResponse.body.saved, false);
    assert.equal(previewResponse.body.timetable.status, "preview");
    assert.equal(previewResponse.body.timetable._id, undefined);
    assert.equal(stubs.updateCalls, 0);

    const saveResponse = responseRecorder();
    await controller.saveGenerated(
      {
        body: {
          sectionId: "section-1",
          roomPool,
          variationSeed: previewResponse.body.variationSeed,
          grid: previewResponse.body.timetable.grid,
        },
      },
      saveResponse
    );

    assert.equal(saveResponse.statusCode, 200);
    assert.equal(saveResponse.body.success, true);
    assert.equal(saveResponse.body.saved, true);
    assert.equal(saveResponse.body.timetable._id, "saved-timetable");
    assert.equal(stubs.updateCalls, 1);
    assert.equal(stubs.lastUpdate.update.status, "generated");
  } finally {
    stubs.restore();
  }
});

test("save rejects a modified or stale preview without writing", async () => {
  const stubs = installGenerationStubs({
    subjects: [
      {
        _id: "databases",
        name: "Database Systems",
        code: "DBS",
        type: "theory",
        weeklySlots: 1,
        allowedTeachers: ["teacher-2"],
      },
    ],
    teachers: [{ _id: "teacher-2", name: "Teacher Two" }],
  });

  try {
    const previewResponse = responseRecorder();
    await controller.generatePreview(
      {
        body: {
          sectionId: "section-1",
          roomPool: [],
          variationSeed: 67890,
        },
      },
      previewResponse
    );

    const changedGrid = structuredClone(previewResponse.body.timetable.grid);
    const occupiedCell = changedGrid
      .flat()
      .find((cell) => cell && cell.subjectId === "databases");
    occupiedCell.teacherId = "different-teacher";

    const saveResponse = responseRecorder();
    await controller.saveGenerated(
      {
        body: {
          sectionId: "section-1",
          roomPool: [],
          variationSeed: previewResponse.body.variationSeed,
          grid: changedGrid,
        },
      },
      saveResponse
    );

    assert.equal(saveResponse.statusCode, 409);
    assert.equal(saveResponse.body.saved, false);
    assert.equal(saveResponse.body.regenerateRequired, true);
    assert.equal(stubs.updateCalls, 0);
  } finally {
    stubs.restore();
  }
});

test("an altered timetable is validated and saved with edited status", async () => {
  const stubs = installGenerationStubs({
    subjects: [
      {
        _id: "editable-subject",
        name: "Editable Subject",
        code: "EDIT",
        type: "theory",
        weeklySlots: 1,
        allowedTeachers: ["editable-teacher"],
      },
    ],
    teachers: [{ _id: "editable-teacher", name: "Editable Teacher" }],
  });

  try {
    const grid = Array.from({ length: 6 }, () => Array(9).fill(null));
    grid[2][3] = {
      subjectId: "editable-subject",
      subjectName: "Editable Subject",
      teacherId: "editable-teacher",
      teacherName: "Editable Teacher",
      room: "CSLH-001",
      type: "theory",
      blockId: null,
      duration: 1,
      batch: null,
      parallelGroup: null,
    };
    const response = responseRecorder();

    await controller.saveEdited(
      {
        body: {
          sectionId: "section-1",
          roomPool: [],
          grid,
        },
      },
      response
    );

    assert.equal(response.statusCode, 200);
    assert.equal(response.body.success, true);
    assert.equal(response.body.saved, true);
    assert.equal(stubs.updateCalls, 1);
    assert.equal(stubs.lastUpdate.update.status, "edited");
    assert.deepEqual(stubs.lastUpdate.update.grid, grid);
  } finally {
    stubs.restore();
  }
});

test("drop validation blocks a teacher clash without writing to MongoDB", async () => {
  const stubs = installGenerationStubs({
    subjects: [
      {
        _id: "clash-a",
        name: "Clash A",
        code: "CLA",
        type: "theory",
        weeklySlots: 1,
        allowedTeachers: ["shared-teacher"],
      },
      {
        _id: "clash-b",
        name: "Clash B",
        code: "CLB",
        type: "theory",
        weeklySlots: 1,
        allowedTeachers: ["shared-teacher"],
      },
    ],
    teachers: [{ _id: "shared-teacher", name: "Shared Teacher" }],
  });

  try {
    const grid = Array.from({ length: 6 }, () => Array(9).fill(null));
    grid[0][0] = {
      subjectId: "clash-a",
      subjectName: "Clash A",
      teacherId: "shared-teacher",
      teacherName: "Shared Teacher",
      room: "CSLH-001",
      type: "theory",
      duration: 1,
    };
    grid[0][1] = {
      subjectId: "clash-b",
      subjectName: "Clash B",
      teacherId: "shared-teacher",
      teacherName: "Shared Teacher",
      room: "CSLH-001",
      type: "theory",
      duration: 1,
    };
    const response = responseRecorder();

    await controller.validateEdited(
      {
        body: {
          sectionId: "section-1",
          roomPool: [],
          grid,
        },
      },
      response
    );

    assert.equal(response.statusCode, 422);
    assert.equal(response.body.success, false);
    assert.match(response.body.error, /double-books|consecutive/i);
    assert.equal(stubs.updateCalls, 0);
  } finally {
    stubs.restore();
  }
});
