const mongoose = require("mongoose");

const fixedSlotSchema = new mongoose.Schema(
  {
    day: { type: Number, min: 0, max: 5, required: true },
    startSlot: {
      type: Number,
      enum: [0, 1, 3, 4, 6, 7, 8],
      required: true,
    },
  },
  { _id: false }
);

const batchAssignmentSchema = new mongoose.Schema(
  {
    batch: { type: String, required: true, trim: true },
    allowedTeachers: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Teacher",
      },
    ],
    roomOptions: [{ type: String, trim: true }],
  },
  { _id: false }
);

const subjectSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    code: { type: String, required: true },
    type: {
      type: String,
      enum: ["theory", "lab", "tutorial", "activity", "project"],
      required: true,
    },
    weeklySlots: { type: Number, required: true },
    // Legacy lab records use duration. sessionDuration extends the same block
    // concept to theory, activity, and project sessions without breaking them.
    duration: { type: Number, default: 2 },
    sessionDuration: { type: Number, min: 1, max: 3, default: null },
    batches: [{ type: String }],
    // Subjects in the same parallelGroup may occupy one section slot together
    // when they target different batches, teachers, and rooms.
    parallelGroup: { type: String, default: "", trim: true },
    roomOptions: [{ type: String, trim: true }],
    batchAssignments: {
      type: [batchAssignmentSchema],
      default: [],
    },
    // Optional locked placements for institutional activities or approved
    // blocks. Slot indexes use the stored 6 x 9 timetable grid.
    fixedSlots: {
      type: [fixedSlotSchema],
      default: [],
    },
    allowedTeachers: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Teacher",
      },
    ],

    sectionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Section",
      default: null,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Subject", subjectSchema);
