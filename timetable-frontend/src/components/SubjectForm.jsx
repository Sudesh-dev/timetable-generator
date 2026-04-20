import { useEffect, useState } from "react";
import API from "../api/api";

const input = {
  padding: "10px",
  borderRadius: "8px",
  border: "1px solid #cbd5e1",
  fontSize: "14px"
};

const button = {
  marginTop: "20px",
  padding: "12px",
  background: "#2563eb",
  color: "white",
  border: "none",
  borderRadius: "8px",
  fontWeight: "bold",
  cursor: "pointer"
};

const th = {
  padding: "10px",
  textAlign: "left"
};

const td = {
  padding: "10px",
  borderTop: "1px solid #e2e8f0"
};

const editBtn = {
  marginRight: "10px",
  background: "#dbeafe",
  color: "#1e40af",
  border: "none",
  padding: "6px 10px",
  borderRadius: "6px",
  cursor: "pointer"
};

const deleteBtn = {
  background: "#fee2e2",
  color: "#b91c1c",
  border: "none",
  padding: "6px 10px",
  borderRadius: "6px",
  cursor: "pointer"
};

export default function SubjectForm() {
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [type, setType] = useState("theory");
  const [weeklySlots, setWeeklySlots] = useState("");

  const [teachers, setTeachers] = useState([]);
  const [selectedTeacher, setSelectedTeacher] = useState("");

  const [sections, setSections] = useState([]);
  const [sectionId, setSectionId] = useState("");

  const [subjectsList, setSubjectsList] = useState([]);

  // 🔥 LOAD ALL DATA
  useEffect(() => {
    loadData();
    fetchSubjects();
  }, []);

  const loadData = async () => {
    try {
      const teachersRes = await API.get("/teachers");
      setTeachers(teachersRes.data);

      const sectionsRes = await API.get("/sections");
      setSections(sectionsRes.data);
    } catch (err) {
      alert("Failed to load teachers/sections");
    }
  };

  const fetchSubjects = async () => {
    try {
      const res = await API.get("/subjects");
      setSubjectsList(res.data);
    } catch (err) {
      console.log(err);
    }
  };

  // 🔥 ADD SUBJECT
  const handleSubmit = async () => {
    const parsedWeeklySlots = Number(weeklySlots);

    if (!name.trim() || !code.trim()) {
      alert("Name and code are required");
      return;
    }

    if (!selectedTeacher || !sectionId) {
      alert("Please select both teacher and section");
      return;
    }

    if (!Number.isInteger(parsedWeeklySlots) || parsedWeeklySlots <= 0) {
      alert("Weekly slots must be a positive integer");
      return;
    }

    try {
      await API.post("/subjects", {
        name: name.trim(),
        code: code.trim(),
        type,
        weeklySlots: parsedWeeklySlots,
        sectionId,
        allowedTeachers: [selectedTeacher],
      });

      alert("Subject Added");

      // refresh table
      fetchSubjects();

      // clear form
      setName("");
      setCode("");
      setType("theory");
      setWeeklySlots("");
      setSelectedTeacher("");
      setSectionId("");

    } catch (err) {
      const message = err.response?.data?.error || "Failed to add subject";
      alert(message);
    }
  };

  // 🔥 DELETE
  const handleDelete = async (id) => {
    await API.delete(`/subjects/${id}`);
    fetchSubjects();
  };

  // 🔥 EDIT (prefill form)
  const handleEdit = (s) => {
    setName(s.name);
    setCode(s.code);
    setType(s.type);
    setWeeklySlots(s.weeklySlots);
    setSectionId(s.sectionId?._id || s.sectionId);
    setSelectedTeacher(s.allowedTeachers?.[0]?._id || s.allowedTeachers?.[0]);
  };

  return (
  <div style={{
    maxWidth: "900px",
    margin: "40px auto",
    padding: "20px"
  }}>

    <h2 style={{
      marginBottom: "20px",
      color: "#1e293b"
    }}>
      📘 Subject Management
    </h2>

    <div style={{
      background: "#ffffff",
      padding: "25px",
      borderRadius: "12px",
      boxShadow: "0 4px 12px rgba(0,0,0,0.08)"
    }}>

      <h3 style={{ marginBottom: "20px" }}>Add Subject</h3>

      <div style={{
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        gap: "15px"
      }}>

        <input
          placeholder="Subject Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          style={input}
        />

        <input
          placeholder="Subject Code"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          style={input}
        />

        <select value={type} onChange={(e) => setType(e.target.value)} style={input}>
          <option value="theory">Theory</option>
          <option value="lab">Lab</option>
        </select>

        <input
          type="number"
          placeholder="Weekly Slots"
          value={weeklySlots}
          onChange={(e) => setWeeklySlots(e.target.value)}
          style={input}
        />

        <select value={selectedTeacher} onChange={(e) => setSelectedTeacher(e.target.value)} style={input}>
          <option value="">Select Teacher</option>
          {teachers.map(t => (
            <option key={t._id} value={t._id}>{t.name}</option>
          ))}
        </select>

        <select value={sectionId} onChange={(e) => setSectionId(e.target.value)} style={input}>
          <option value="">Select Section</option>
          {sections.map(s => (
            <option key={s._id} value={s._id}>{s.name}</option>
          ))}
        </select>

      </div>

      <button onClick={handleSubmit} style={button}>
        ➕ Add Subject
      </button>
    </div>

    {/* TABLE */}
    <div style={{
      marginTop: "25px",
      background: "#fff",
      padding: "20px",
      borderRadius: "12px",
      boxShadow: "0 4px 12px rgba(0,0,0,0.08)"
    }}>

      <h3 style={{ marginBottom: "15px" }}>Saved Subjects</h3>

      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr style={{ background: "#f1f5f9" }}>
            <th style={th}>Name</th>
            <th style={th}>Code</th>
            <th style={th}>Type</th>
            <th style={th}>Slots</th>
            <th style={th}>Actions</th>
          </tr>
        </thead>

        <tbody>
          {subjectsList.map((s) => (
            <tr key={s._id}>
              <td style={td}>{s.name}</td>
              <td style={td}>{s.code}</td>
              <td style={td}>{s.type}</td>
              <td style={td}>{s.weeklySlots}</td>
              <td style={td}>
                <button style={editBtn} onClick={() => handleEdit(s)}>Edit</button>
                <button style={deleteBtn} onClick={() => handleDelete(s._id)}>Delete</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

    </div>
  </div>
);
}