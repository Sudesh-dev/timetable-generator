const mongoose = require("mongoose");

function isISOCalendarDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

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
    workingPeriod: {
      startDate: {
        type: String,
        required: true,
        validate: {
          validator: isISOCalendarDate,
          message: "startDate must be a valid YYYY-MM-DD date",
        },
      },
      endDate: {
        type: String,
        required: true,
        validate: {
          validator: isISOCalendarDate,
          message: "endDate must be a valid YYYY-MM-DD date",
        },
      },
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

timetableSchema.path("workingPeriod.endDate").validate(function validateDateOrder(value) {
  return !this.workingPeriod?.startDate || value >= this.workingPeriod.startDate;
}, "endDate must be on or after startDate");

module.exports = mongoose.model("Timetable", timetableSchema);
