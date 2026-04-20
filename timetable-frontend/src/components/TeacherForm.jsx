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
    } catch (err) {
      const message = err.response?.data?.error || "Failed to add teacher";
      alert(message);
    }
  };

  return (
    <div>
      <h3>Add Teacher</h3>
      <input
        placeholder="Teacher Name"
        value={name}
        onChange={(e) => setName(e.target.value)}
      />
      <button onClick={handleSubmit}>Add</button>
    </div>
  );
}