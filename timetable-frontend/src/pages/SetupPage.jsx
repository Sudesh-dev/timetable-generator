import { Link } from "react-router-dom";
import SubjectForm from "../components/SubjectForm";

export default function SetupPage() {
  return (
    <div className="page-shell">
      <h1>Setup</h1>

      <div className="page-actions">
        <Link to="/teachers"><button>Manage Professors</button></Link>
        <Link to="/sections"><button>Manage Sections</button></Link>
      </div>

      <SubjectForm />

      <Link to="/generate">
        <button>Generate Timetable</button>
      </Link>
    </div>
  );
}