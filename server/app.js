const express = require("express");
const cors = require("cors");
const connectDB = require("./config/db");

const app = express();

connectDB();

app.use(cors());
app.use(express.json());

app.use("/api/timetable", require("./routes/timetableRoutes"));
app.use("/api/teachers", require("./routes/teacherRoutes"));
app.use("/api/subjects", require("./routes/subjectRoutes"));
app.use("/api/sections", require("./routes/sectionRoutes"));

module.exports = app;