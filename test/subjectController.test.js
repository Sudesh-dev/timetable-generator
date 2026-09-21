const test = require("node:test");
const assert = require("node:assert/strict");

const Subject = require("../server/models/Subject");
const controller = require("../server/controllers/subjectController");

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

test("subject updates use validation and return the updated record", async () => {
  const original = Subject.findByIdAndUpdate;
  let received = null;
  Subject.findByIdAndUpdate = async (id, update, options) => {
    received = { id, update, options };
    return { _id: id, ...update };
  };

  try {
    const req = {
      params: { id: "subject-1" },
      body: {
        name: "Operating Systems",
        code: "BCS401",
        weeklySlots: 4,
      },
    };
    const res = responseRecorder();

    await controller.updateSubject(req, res);

    assert.equal(res.statusCode, 200);
    assert.equal(res.body.name, "Operating Systems");
    assert.equal(received.id, "subject-1");
    assert.equal(received.options.new, true);
    assert.equal(received.options.runValidators, true);
  } finally {
    Subject.findByIdAndUpdate = original;
  }
});

test("subject update and delete report missing records", async () => {
  const originalUpdate = Subject.findByIdAndUpdate;
  const originalDelete = Subject.findByIdAndDelete;
  Subject.findByIdAndUpdate = async () => null;
  Subject.findByIdAndDelete = async () => null;

  try {
    const updateResponse = responseRecorder();
    await controller.updateSubject(
      { params: { id: "missing" }, body: { name: "Missing" } },
      updateResponse
    );
    assert.equal(updateResponse.statusCode, 404);

    const deleteResponse = responseRecorder();
    await controller.deleteSubject(
      { params: { id: "missing" } },
      deleteResponse
    );
    assert.equal(deleteResponse.statusCode, 404);
  } finally {
    Subject.findByIdAndUpdate = originalUpdate;
    Subject.findByIdAndDelete = originalDelete;
  }
});

test("subject validation failures return a client error", async () => {
  const original = Subject.create;
  Subject.create = async () => {
    const error = new Error("weeklySlots must be at least one");
    error.name = "ValidationError";
    throw error;
  };

  try {
    const res = responseRecorder();
    await controller.createSubject({ body: {} }, res);
    assert.equal(res.statusCode, 400);
    assert.match(res.body.error, /weeklySlots/i);
  } finally {
    Subject.create = original;
  }
});
