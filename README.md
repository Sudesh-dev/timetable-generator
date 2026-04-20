# Timetable Generator

A full-stack timetable generation app built with Node.js, Express, MongoDB, React, and Vite.

## What this project does

- Manage teachers, sections, and subjects
- Generate a weekly timetable for a selected section
- View generated timetable data in a grid
- Edit individual timetable slots through API
- Filter timetable data by teacher through API

## Tech stack

### Backend
- Node.js
- Express
- MongoDB + Mongoose
- dotenv

### Frontend
- React
- Vite
- Axios
- React Router

## Project structure

```text
server/
  app.js
  server.js
  config/
    db.js
  controllers/
  models/
  routes/
  services/

timetable-frontend/
  src/
    api/
    components/
    pages/
```

## Prerequisites

- Node.js 18+ recommended
- npm
- MongoDB (local or cloud)

## Environment variables

Create a `.env` file in the project root:

```env
MONGO_URI=your_mongodb_connection_string
PORT=5000
```

Notes:
- `MONGO_URI` is required.
- `PORT` is optional (defaults to `5000`).

## Install dependencies

From project root:

```bash
npm install
cd timetable-frontend
npm install
```

## Run the app

### 1) Start backend

From project root:

```bash
npm run dev
```

Backend runs on: `http://localhost:5000`

### 2) Start frontend

In a second terminal:

```bash
cd timetable-frontend
npm run dev
```

Frontend runs on Vite default URL (usually `http://localhost:5173`).

## Frontend routes

- `/` -> Setup page (teacher, section, subject forms)
- `/generate` -> Generate timetable page

## API base URL

Frontend uses:

`http://localhost:5000/api`

## API endpoints

### Teachers
- `POST /api/teachers` create teacher
- `GET /api/teachers` list teachers

### Sections
- `POST /api/sections` create section
- `GET /api/sections` list sections

### Subjects
- `POST /api/subjects` create subject
- `GET /api/subjects` list subjects
- `DELETE /api/subjects/:id` delete subject

### Timetable
- `POST /api/timetable/generate` generate and save timetable for a section
- `GET /api/timetable` list all timetables
- `GET /api/timetable/:sectionId` get timetable by section
- `GET /api/timetable/teacher/:teacherId` get teacher-specific timetable view
- `PUT /api/timetable/slot` update one timetable cell

## Example payloads

### Create section

```json
{
  "name": "CSE-2",
  "semester": 4,
  "classroom": "CSLH-001"
}
```

### Create subject

```json
{
  "name": "Operating Systems",
  "code": "CS402",
  "type": "theory",
  "weeklySlots": 4,
  "sectionId": "<section_id>",
  "allowedTeachers": ["<teacher_id>"]
}
```

### Generate timetable

```json
{
  "sectionId": "<section_id>",
  "classroom": "CSLH-001",
  "roomPool": [
    { "name": "Lab 1" },
    { "name": "Lab 2" }
  ]
}
```

### Update one slot

```json
{
  "timetableId": "<timetable_id>",
  "day": 0,
  "slot": 1,
  "value": {
    "subjectId": "<subject_id>",
    "subjectName": "Operating Systems",
    "teacherId": "<teacher_id>",
    "teacherName": "Prof A",
    "room": "CSLH-001",
    "type": "theory"
  }
}
```

## Scripts

### Root
- `npm run dev` start backend with nodemon

### Frontend
- `npm run dev` start Vite dev server
- `npm run build` build production assets
- `npm run lint` lint frontend code
- `npm run preview` preview production build

## Troubleshooting

- Error: `MONGO_URI` missing or connection fails
  - Confirm `.env` is in project root and MongoDB is reachable.

- Frontend cannot reach API
  - Ensure backend is running on `http://localhost:5000`.
  - Ensure frontend API base URL in `timetable-frontend/src/api/api.js` matches backend host/port.

- Timetable generation returns warnings
  - Review subject teacher assignments, lab room count, and weekly slot constraints.

## Current status

The app is set up for local development with separate backend and frontend processes.
