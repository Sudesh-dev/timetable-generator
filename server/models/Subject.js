const mongoose = require("mongoose");

const subjectSchema = new mongoose.Schema({
  name: { type: String, required: true },
  code: { type: String, required: true },

  type: {
    type: String,
    enum: ["theory", "lab", "tutorial"],
    required: true,
  },

  // number of classes per week
  weeklySlots: { type: Number, required: true },

  // lab only
  duration: { type: Number, default: 2 }, // 2 or 3 slots
  batches: [{ type: String }], // ["B1", "B2"]

  // multiple teachers allowed
  allowedTeachers: [
    { type: mongoose.Schema.Types.ObjectId, ref: "Teacher" }
  ],
});

module.exports = mongoose.model("Subject", subjectSchema);