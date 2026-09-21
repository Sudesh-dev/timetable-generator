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
- B1/B2/B3 batch scheduling and parallel laboratory rotations
- Fixed multi-period activity and project blocks
- Configurable teacher availability and lower daily limits
- Teacher conflict checks across saved section timetables
- Classroom and laboratory-room conflict checks
- Retry generation with alternative valid candidate ordering
- Round-robin subject placement with no internal student timetable gaps
- Constraint warnings when a complete timetable is not possible
- Explicit save-to-database confirmation after generation
- Drag-and-drop timetable editing with validated database saves
- PDF preview for saved or unsaved timetables; download only after saving
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

For a deployed frontend, set `VITE_API_URL` to the public backend API URL.

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
- `PUT /api/subjects/:id`
- `DELETE /api/subjects/:id`

### Timetable

- `POST /api/timetable/generate` (preview only; does not write to MongoDB)
- `POST /api/timetable/save` (revalidates and saves the selected preview)
- `POST /api/timetable/validate-edited` (checks a proposed drag without saving)
- `POST /api/timetable/save-edited` (validates and saves a drag-and-drop edit)
- `GET /api/timetable`
- `GET /api/timetable/:sectionId`
- `GET /api/timetable/teacher/:teacherId`

## Generation Rules

The backend planner currently enforces:

- six working days and seven teaching periods per day
- break and lunch slots remain unavailable
- at most one session of the same subject per section per day
- subjects are considered in round-robin order; a temporarily invalid subject
  is skipped and the next subject is checked
- no unused teaching period between a day's first and last class
- at most three teaching sessions per professor per day
- a gap between separate sessions taught by the same professor
- no professor assigned to two saved sections at the same time
- labs remain continuous for their configured duration
- no classroom or lab-room clashes with saved timetables
- one consistent professor selected from a subject's `allowedTeachers`
- different teachers and rooms for simultaneous batch labs
- at most one lab rotation per batch from the same parallel group each day
- configured teacher unavailable periods
- an optional lower teacher session limit (never above three)
- optional fixed placements for projects and institutional activities

A continuous lab block counts as one teaching session for the professor's
daily limit. Consecutive periods inside one block are allowed; the teacher gap
rule applies between separate sessions. When all configured periods cannot be
placed, the API returns `success: false` and specific warnings. A failed retry
does not overwrite the section's previously saved timetable.

Every generation request loads the other saved section timetables from MongoDB.
Their teacher, classroom, and laboratory occupancy is treated as unavailable.
Pressing Generate again reuses the same master data and explores a different
ordering among equally valid candidates; no teacher, subject, or section data
needs to be re-entered. Generation returns an unsaved preview. MongoDB is only
updated after the user clicks **Save Timetable to DB**. Preview is available in
both states, while PDF download is enabled only for a saved timetable.

Generated and previously saved timetables can be edited by dragging a class to
an empty period or onto another class of the same duration to swap them. Lab and
project sessions move as complete continuous blocks. An edit marks the current
view as unsaved and enables **Save Changes to DB**. The server checks the full
edited grid against subject counts, fixed placements, teacher availability,
teacher and room clashes, daily limits, continuity, and student gaps before it
is shown. Invalid drops are blocked and the original timetable remains
unchanged. The same validation runs again before MongoDB is updated.

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
  "teacherId": "T-102",
  "maxSessionsPerDay": 3,
  "unavailableSlots": [
    { "day": 0, "slot": 0 }
  ]
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

### Create Parallel Batch Labs

Subjects sharing a `parallelGroup` may run at the same time when their batches,
teachers, and rooms are different. `weeklySlots` is the weekly period count for
each configured batch.

```json
{
  "name": "Machine Learning Lab",
  "code": "BCSL606",
  "type": "lab",
  "weeklySlots": 2,
  "duration": 2,
  "sectionId": "<section_id>",
  "parallelGroup": "sixth-sem-lab-rotation",
  "batchAssignments": [
    {
      "batch": "B1",
      "allowedTeachers": ["<teacher_1_id>"],
      "roomOptions": ["Lab 3"]
    },
    {
      "batch": "B2",
      "allowedTeachers": ["<teacher_2_id>"],
      "roomOptions": ["Lab 3"]
    },
    {
      "batch": "B3",
      "allowedTeachers": ["<teacher_3_id>"],
      "roomOptions": ["Lab 3"]
    }
  ]
}
```

Create the paired lab as another subject with the same `parallelGroup`, its own
batch teachers, and different room options. The saved timetable stores every
parallel session separately for future conflict detection while also returning
a combined cell compatible with the existing timetable UI.

### Create a Fixed Project Block

```json
{
  "name": "Project Phase I",
  "code": "BCS685",
  "type": "project",
  "weeklySlots": 2,
  "sessionDuration": 2,
  "sectionId": "<section_id>",
  "allowedTeachers": ["<teacher_id>"],
  "fixedSlots": [
    { "day": 2, "startSlot": 6 }
  ]
}
```

Days are zero-based (`0` is Monday). Teaching grid indexes are
`0, 1, 3, 4, 6, 7, 8`; indexes `2` and `5` are break and lunch.

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

The response contains `variationSeed` and `timetable.grid`. Send both values
unchanged when the user confirms the save:

```json
{
  "sectionId": "<section_id>",
  "variationSeed": 123456789,
  "roomPool": [
    { "name": "Lab 1" },
    { "name": "Lab 2" }
  ],
  "grid": "<exact 6 x 9 timetable.grid returned by generate>"
}
```

Before writing, the save endpoint regenerates the candidate against the latest
saved timetables. If teachers, rooms, subjects, or another section changed, it
returns HTTP `409` and asks the client to generate a fresh preview.

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
