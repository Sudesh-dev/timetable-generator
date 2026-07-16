const mongoose = require('mongoose');

const labSchema = new mongoose.Schema({
  name: String
});

module.exports = mongoose.model('LabRoom', labSchema);