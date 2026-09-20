const mongoose = require("mongoose");

const unavailableSlotSchema = new mongoose.Schema(
  {
    day: { type: Number, min: 0, max: 5, required: true },
    slot: {
      type: Number,
      enum: [0, 1, 3, 4, 6, 7, 8],
      required: true,
    },
  },
  { _id: false }
);

const teacherSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    teacherId: { type: String, default: "" },
    email: { type: String, default: "" },
    // A teacher may opt for a lower load, but the institutional maximum is
    // always three sessions per day.
    maxSessionsPerDay: { type: Number, min: 1, max: 3, default: 3 },
    unavailableSlots: {
      type: [unavailableSlotSchema],
      default: [],
    },
    subjects: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Subject",
      },
    ],
  },
  { timestamps: true }
);

module.exports = mongoose.model("Teacher", teacherSchema);
