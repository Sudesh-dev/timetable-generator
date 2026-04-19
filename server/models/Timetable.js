const mongoose = require('mongoose');

const timetableSchema = new mongoose.Schema({
  sectionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Section'
  },
  days: Array,
  warnings: [String]
});

module.exports = mongoose.model('Timetable', timetableSchema);