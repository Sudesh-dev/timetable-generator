# Timetable Generator

A full-stack timetable generation application built with:

- Node.js
- Express.js
- MongoDB
- React
- Vite

## Prerequisites

Install the following before running the project:

- Node.js
- npm
- MongoDB, or a MongoDB Atlas account
- Git

## Clone the repository

```bash
git clone https://github.com/Roopathanushree/Timetable-updated.git
cd Timetable-updated
```

## Backend setup

Install the backend dependencies from the project root:

```bash
npm install
```

Create a `.env` file in the project root:

```env
MONGO_URI=your_mongodb_connection_string
PORT=5001
```

Start the backend:

```bash
npm run dev
```

If the development command is unavailable, check the available scripts:

```bash
npm run
```

Then use:

```bash
npm start
```

## Frontend setup

Open another terminal and run:

```bash
cd timetable-frontend
npm install
npm run dev
```

The frontend will normally run at:

```text
http://localhost:5173
```

The backend will normally run at:

```text
http://localhost:5001
```

## Environment variables

The actual `.env` file is not included in GitHub for security reasons.

Example:

```env
MONGO_URI=your_mongodb_connection_string
PORT=5001
```

## Important

Never push passwords, API keys, or MongoDB credentials to GitHub.

The `.gitignore` file should contain:

```gitignore
node_modules/
.env
.env.*
dist/
build/
.DS_Store
```
