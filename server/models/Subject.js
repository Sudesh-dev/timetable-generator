const mongoose = require("mongoose");

const subjectSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    code: { type: String, required: true },
    type: {
      type: String,
      enum: ["theory", "lab", "tutorial"],
      required: true,
    },
    weeklySlots: { type: Number, required: true },
    duration: { type: Number, default: 2 },
    batches: [{ type: String }],
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