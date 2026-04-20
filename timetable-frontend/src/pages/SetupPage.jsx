import TeacherForm from "../components/TeacherForm";
import SubjectForm from "../components/SubjectForm";
import SectionForm from "../components/SectionForm";
import { Link } from "react-router-dom";

export default function SetupPage() {
  return (
    <div>

      <h1 style={{ marginBottom: "20px" }}>Setup Data</h1>

      <TeacherForm />
      <SectionForm />
      <SubjectForm />

      <div style={{ textAlign: "center", marginTop: "20px" }}>
        <Link to="/generate">
          <button>➡ Go to Generate Timetable</button>
        </Link>
      </div>

    </div>
  );
}