import { useState } from "react";
import API from "../api/api";

export default function TeacherForm() {
  const [name, setName] = useState("");

  const handleSubmit = async () => {
    if (!name.trim()) {
      alert("Teacher name is required");
      return;
    }

    try {
      await API.post("/teachers", { name: name.trim() });
      alert("Teacher Added");
      setName("");
    } catch {
      alert("Failed to add teacher");
    }
  };

  return (
    <div className="card">
      <h3>Add Teacher</h3>

      <div className="form-grid">
        <input
          placeholder="Teacher Name"
          value={name}
          onChange={(e)=>setName(e.target.value)}
        />
      </div>

      <button onClick={handleSubmit}>+ Add Teacher</button>
    </div>
  );
}