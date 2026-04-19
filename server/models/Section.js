const mongoose = require('mongoose');

const sectionSchema = new mongoose.Schema({
  name: String,
  semester: Number,
  classroom: String
});

module.exports = mongoose.model('Section', sectionSchema);