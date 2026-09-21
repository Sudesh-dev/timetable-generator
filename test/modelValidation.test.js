const test = require("node:test");
const assert = require("node:assert/strict");
const mongoose = require("mongoose");

const Section = require("../server/models/Section");
const Subject = require("../server/models/Subject");
const Teacher = require("../server/models/Teacher");
const Timetable = require("../server/models/Timetable");

test("section semesters are limited to the supported range", async () => {
  const section = new Section({
    name: "CSE-A",
    semester: 9,
    classroom: "CSLH-001",
  });

  await assert.rejects(section.validate(), (error) => {
    assert.ok(error?.errors?.semester);
    return true;
  });
});

test("subjects require a section and a positive weekly period count", async () => {
  const subject = new Subject({
    name: "Invalid Subject",
    code: "INVALID",
    type: "theory",
    weeklySlots: 0,
    allowedTeachers: [new mongoose.Types.ObjectId()],
  });

  await assert.rejects(subject.validate(), (error) => {
    assert.ok(error?.errors?.weeklySlots);
    assert.ok(error?.errors?.sectionId);
    return true;
  });
});

test("teacher identifiers and names are trimmed before storage", () => {
  const teacher = new Teacher({
    name: "  Prof. Kumar  ",
    teacherId: "  T-101  ",
  });

  assert.equal(teacher.name, "Prof. Kumar");
  assert.equal(teacher.teacherId, "T-101");
});

test("timetable working dates must be ordered ISO calendar dates", async () => {
  const timetable = new Timetable({
    sectionId: new mongoose.Types.ObjectId(),
    semester: 3,
    classroom: "CSLH-001",
    workingPeriod: {
      startDate: "2026-12-15",
      endDate: "2026-08-01",
    },
    grid: Array.from({ length: 6 }, () => Array(9).fill(null)),
  });

  await assert.rejects(timetable.validate(), (error) => {
    assert.ok(error?.errors?.["workingPeriod.endDate"]);
    return true;
  });

  const impossibleDate = new Timetable({
    sectionId: new mongoose.Types.ObjectId(),
    semester: 3,
    classroom: "CSLH-001",
    workingPeriod: {
      startDate: "2026-02-30",
      endDate: "2026-03-01",
    },
    grid: Array.from({ length: 6 }, () => Array(9).fill(null)),
  });

  await assert.rejects(impossibleDate.validate(), (error) => {
    assert.ok(error?.errors?.["workingPeriod.startDate"]);
    return true;
  });
});
