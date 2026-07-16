# Timetable Frontend

Frontend app for the Timetable Generator project.

## Stack

- React
- Vite
- React Router
- Axios
- jsPDF
- html2canvas

## Available Pages

- `/` setup page
- `/teachers` teacher CRUD UI
- `/sections` section CRUD UI
- `/generate` timetable generation and PDF export

## Key UI Behavior

- Mobile-first responsive layout
- Back navigation button on secondary pages
- Empty-state blocks with light gray background when data is missing
- Semester and section dropdown filters in setup/generate flows

## Scripts

```bash
npm run dev
npm run build
npm run preview
npm run lint
```

## Development Notes

- API base URL is configured in `src/api/api.js`
- Expected backend URL: `http://localhost:5000/api`
- If API requests fail, verify backend is running and CORS is enabled
