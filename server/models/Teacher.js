const mongoose = require('mongoose');

const teacherSchema = new mongoose.Schema({
  name: String
});

module.exports = mongoose.model('Teacher', teacherSchema);