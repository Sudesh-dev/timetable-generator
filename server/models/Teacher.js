const mongoose = require("mongoose");

const teacherSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    email: { type: String, default: "" },
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