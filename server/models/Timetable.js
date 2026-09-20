const mongoose = require("mongoose");

const timetableSchema = new mongoose.Schema(
  {
    departmentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Department",
      default: null,
    },
    sectionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Section",
      required: true,
      index: true,
    },
    semester: {
      type: Number,
      required: true,
    },
    classroom: {
      type: String,
      required: true,
    },
    grid: {
      // One array per day and one value per timetable slot (6 x 9).
      // The previous three-dimensional declaration wrapped every saved grid
      // in an unintended extra array.
      type: [[mongoose.Schema.Types.Mixed]],
      default: [],
    },
    warnings: {
      type: [String],
      default: [],
    },
    generationContext: {
      constraintVersion: { type: String, default: "college-v3-round-robin" },
      referencedTimetableIds: [
        {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Timetable",
        },
      ],
    },
    generatedAt: {
      type: Date,
      default: Date.now,
    },
    status: {
      type: String,
      enum: ["generated", "edited", "approved"],
      default: "generated",
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Timetable", timetableSchema);
