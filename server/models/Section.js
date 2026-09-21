const mongoose = require("mongoose");

const sectionSchema = new mongoose.Schema(
  {
    departmentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Department",
      default: null,
    },
    name: { type: String, required: true, trim: true },
    semester: { type: Number, required: true, min: 1, max: 8 },
    classroom: { type: String, required: true, trim: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Section", sectionSchema);
