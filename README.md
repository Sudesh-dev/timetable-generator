# Timetable Generator

A full-stack timetable generator built with Node.js, Express, MongoDB, React, and Vite.

## Features

- Teacher CRUD (create, list, update, delete)
- Section CRUD (create, list, update, delete)
- Subject management (create, list, delete)
- Subject filters by semester and section
- Data-driven timetable generation by semester and section
- Exact weekly-period scheduling from each subject's `weeklySlots`
- Continuous 2- or 3-period laboratory blocks
- Teacher conflict checks across saved section timetables
- Classroom and laboratory-room conflict checks
- Constraint warnings when a complete timetable is not possible
- PDF preview and download for generated timetable
- Empty-state UI messaging when data is missing
- Mobile-first responsive frontend layout

## Tech Stack

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
- jsPDF
- html2canvas

## Project Structure

```text
server/
  app.js
  server.js
  config/
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

- Node.js 20.19+
- npm
- MongoDB (local or Atlas)

## Environment Variables

Create a `.env` file in the project root:

```env
MONGO_URI=your_mongodb_connection_string
PORT=5000
```

- `MONGO_URI` is required
- `PORT` is optional (default `5000`)

## Installation

```bash
npm install
cd timetable-frontend
npm install
```

## Run Locally

### 1) Start backend (root)

```bash
npm run dev
```

Backend URL: `http://localhost:5000`

### 2) Start frontend (new terminal)

```bash
cd timetable-frontend
npm run dev
```

Frontend URL: usually `http://localhost:5173`

## Frontend Routes

- `/` setup page (subject setup + navigation)
- `/teachers` manage professors
- `/sections` manage sections
- `/generate` generate and export timetable

## API Base URL

Frontend points to:

`http://localhost:5000/api`

## API Endpoints

### Teachers

- `POST /api/teachers`
- `GET /api/teachers`
- `PUT /api/teachers/:id`
- `DELETE /api/teachers/:id`

### Sections

- `POST /api/sections`
- `GET /api/sections`
- `PUT /api/sections/:id`
- `DELETE /api/sections/:id`

### Subjects

- `POST /api/subjects`
- `GET /api/subjects`
- `DELETE /api/subjects/:id`

### Timetable

- `POST /api/timetable/generate`
- `GET /api/timetable`
- `GET /api/timetable/:sectionId`
- `GET /api/timetable/teacher/:teacherId`
- `PUT /api/timetable/slot`

## Generation Rules

The backend planner currently enforces:

- six working days and seven teaching periods per day
- break and lunch slots remain unavailable
- at most one session of the same subject per section per day
- at most three teaching sessions per professor per day
- a gap between separate sessions taught by the same professor
- no professor assigned to two saved sections at the same time
- labs remain continuous for their configured duration
- no classroom or lab-room clashes with saved timetables
- one consistent professor selected from a subject's `allowedTeachers`

A continuous lab block counts as one teaching session for the professor's
daily limit. When all configured periods cannot be placed, the API returns the
best partial timetable together with specific warnings; it does not invent
fallback subjects or professors.

## Sample Payloads

### Create Section

```json
{
  "name": "CSE-A",
  "semester": 4,
  "classroom": "CSLH-001"
}
```

### Create Teacher

```json
{
  "name": "Prof. Kumar",
  "teacherId": "T-102"
}
```

### Create Subject

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

### Generate Timetable

```json
{
  "sectionId": "<section_id>",
  "roomPool": [
    { "name": "Lab 1" },
    { "name": "Lab 2" }
  ]
}
```

The classroom saved on the selected section is authoritative during
generation. This prevents a client from accidentally generating a timetable
for the wrong classroom.

## Scripts

### Root

- `npm run dev` start backend with nodemon
- `npm test` run backend generator and grid-schema tests

### Frontend

- `npm run dev` start Vite
- `npm run build` production build
- `npm run preview` preview build
- `npm run lint` run ESLint

## Troubleshooting

- Backend not connecting to MongoDB:
  - Check `MONGO_URI` in `.env`
  - Verify MongoDB service/network access

- Frontend API errors:
  - Ensure backend is running on `http://localhost:5000`
  - Confirm `timetable-frontend/src/api/api.js` base URL

- Generate button disabled:
  - Select semester and section
  - Add subjects for that semester/section first
