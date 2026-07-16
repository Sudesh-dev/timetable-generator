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
      type: [[[mongoose.Schema.Types.Mixed]]],
      default: [],
    },
    warnings: {
      type: [String],
      default: [],
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