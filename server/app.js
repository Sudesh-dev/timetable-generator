const express = require('express');
const cors = require('cors');
const connectDB = require('./config/db');

const mongoose = require('mongoose');

const Teacher = require('./models/Teacher'); 
const Subject = require('./models/Subject');
const {
  createEmptyGrid,
  isTeacherFree
} = require('./services/generator');
const app = express();

connectDB();

app.use(cors());
app.use(express.json());

app.get('/', (req, res) => {
  res.send('API Running...');
});

app.get('/test', async (req, res) => {
  const t = await Teacher.create({ name: 'Test Sir' });
  res.json(t);
});

app.get('/add-subject', async (req, res) => {
  const sub = await Subject.create({
    name: 'Math',
    code: 'M101',
    type: 'theory',
    weeklySlots: 3,
    allowedTeachers: [
      new mongoose.Types.ObjectId('69e4c5263e9b205995f34212')
    ]
  });

  res.json(sub);
});

app.get('/add-lab', async (req, res) => {
  const sub = await Subject.create({
    name: 'ML Lab',
    code: 'ML101',
    type: 'lab',
    weeklySlots: 1,
    duration: 2,
    batches: ['B1', 'B2'],
    allowedTeachers: [
      new mongoose.Types.ObjectId('69e4c5263e9b205995f34212')
    ]
  });
  res.json(sub);
});

app.get('/test-grid', (req, res) => {
  const grid = createEmptyGrid();
  res.json(grid);
});

app.get('/test-logic', (req, res) => {
  const grid = createEmptyGrid();

  const free = isTeacherFree(grid, "T1", 0, 0);

  res.json({ free });
});

app.use('/api/timetable', require('./routes/timetableRoutes'));

module.exports = app;