import { Link } from "react-router-dom";

export default function SetupPage() {
  return (
    <div className="page-shell content-narrow home-page">
      <div className="home-heading">
        <h1>Timetable Generator</h1>
        <p className="muted">
          Manage the timetable data, then generate a conflict-free schedule.
        </p>
      </div>

      <div className="home-actions">
        <Link className="home-button" to="/teachers">Manage Teachers</Link>
        <Link className="home-button" to="/sections">Manage Sections</Link>
        <Link className="home-button" to="/subjects">Manage Subjects</Link>
        <Link className="home-button" to="/generate">Generate Timetable</Link>
      </div>
    </div>
  );
}
