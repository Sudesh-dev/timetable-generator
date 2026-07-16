const mongoose = require("mongoose");

const sectionSchema = new mongoose.Schema(
  {
    departmentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Department",
      default: null,
    },
    name: { type: String, required: true },
    semester: { type: Number, required: true },
    classroom: { type: String, required: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Section", sectionSchema);