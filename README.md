# Timetable Generator

A full-stack timetable generator built with Node.js, Express, MongoDB, React, and Vite.

## Features

- Teacher CRUD (create, list, update, delete)
- Section CRUD (create, list, update, delete)
- Subject management (create, list, delete)
- Subject filters by semester and section
- Timetable generation by semester and section
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

- Node.js 18+
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
  "classroom": "CSLH-001",
  "roomPool": [
    { "name": "Lab 1" },
    { "name": "Lab 2" }
  ]
}
```

## Scripts

### Root

- `npm run dev` start backend with nodemon

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
