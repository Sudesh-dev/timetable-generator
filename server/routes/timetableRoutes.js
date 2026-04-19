const express = require('express');
const router = express.Router();

const { generate, getAll } = require('../controllers/timetableController'); // ✅ import both

router.get('/generate', generate);   // for browser
router.post('/generate', generate);  // for Postman
router.get('/', getAll);             // fetch all timetables

module.exports = router;