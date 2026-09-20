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

test("failed generation reports warnings and preserves the saved timetable", async () => {
  const originals = {
    findSection: Section.findById,
    findSubjects: Subject.find,
    findTeachers: Teacher.find,
    findTimetables: Timetable.find,
    updateTimetable: Timetable.findOneAndUpdate,
  };
  let updateCalls = 0;

  Section.findById = async () => ({
    _id: "section-1",
    semester: 3,
    classroom: "CSLH-001",
    departmentId: null,
  });
  Subject.find = async () => [
    {
      _id: "orphan-subject",
      name: "Unassigned Subject",
      code: "ORPHAN",
      type: "theory",
      weeklySlots: 4,
      allowedTeachers: ["missing-teacher"],
    },
  ];
  Teacher.find = async () => [];
  Timetable.find = () => ({
    select() {
      return this;
    },
    populate() {
      return this;
    },
    async lean() {
      return [
        {
          _id: "existing-timetable",
          sectionId: { _id: "section-2", classroom: "CSLH-002" },
          classroom: "CSLH-002",
          grid: [],
        },
      ];
    },
  });
  Timetable.findOneAndUpdate = async () => {
    updateCalls++;
    return null;
  };

  try {
    const req = {
      body: {
        sectionId: "section-1",
        roomPool: [{ name: "Lab 1" }],
      },
    };
    const res = responseRecorder();

    await controller.generateAndSave(req, res);

    assert.equal(res.statusCode, 422);
    assert.equal(res.body.success, false);
    assert.equal(res.body.checkedTimetables, 1);
    assert.match(res.body.warnings.join(" "), /no valid assigned teacher/i);
    assert.equal(updateCalls, 0);
  } finally {
    Section.findById = originals.findSection;
    Subject.find = originals.findSubjects;
    Teacher.find = originals.findTeachers;
    Timetable.find = originals.findTimetables;
    Timetable.findOneAndUpdate = originals.updateTimetable;
  }
});
