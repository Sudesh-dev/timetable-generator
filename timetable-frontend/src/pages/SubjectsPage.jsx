import { useNavigate } from "react-router-dom";
import SubjectForm from "../components/SubjectForm";

export default function SubjectsPage() {
  const navigate = useNavigate();

  return (
    <div className="page-shell">
      <div className="page-actions">
        <button className="btn-secondary" onClick={() => navigate("/")}>
          Back to Home
        </button>
      </div>

      <SubjectForm />
    </div>
  );
}
