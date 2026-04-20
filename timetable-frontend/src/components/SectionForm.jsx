import { useState } from "react";
import API from "../api/api";

export default function SectionForm() {
  const [name, setName] = useState("");
  const [semester, setSemester] = useState("");
  const [classroom, setClassroom] = useState("");

  const handleSubmit = async () => {
    const parsedSemester = Number(semester);

    if (!name.trim() || !classroom.trim()) {
      alert("Name and classroom are required");
      return;
    }

    if (!Number.isInteger(parsedSemester) || parsedSemester <= 0) {
      alert("Semester must be a positive integer");
      return;
    }

    try {
      await API.post("/sections", {
        name: name.trim(),
        semester: parsedSemester,
        classroom: classroom.trim(),
      });

      alert("Section Added");
      setName("");
      setSemester("");
      setClassroom("");
    } catch (err) {
      alert("Failed to add section");
    }
  };

  return (
    <div className="card">
      <h3>Add Section</h3>

      <div className="form-grid">
        <input placeholder="Name" value={name} onChange={(e)=>setName(e.target.value)} />
        <input type="number" placeholder="Semester" value={semester} onChange={(e)=>setSemester(e.target.value)} />
        <input placeholder="Classroom" value={classroom} onChange={(e)=>setClassroom(e.target.value)} />
      </div>

      <button onClick={handleSubmit}>+ Add Section</button>
    </div>
  );
}