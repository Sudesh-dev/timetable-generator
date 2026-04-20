import { useEffect, useState } from "react";
import API from "../api/api";

export default function SubjectForm() {
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [type, setType] = useState("theory");
  const [weeklySlots, setWeeklySlots] = useState("");
  const [teachers, setTeachers] = useState([]);
  const [selectedTeacher, setSelectedTeacher] = useState("");
  const [sections, setSections] = useState([]);
  const [sectionId, setSectionId] = useState("");

  useEffect(() => {
    const loadData = async () => {
      let loadErrors = [];

      try {
        const teachersRes = await API.get("/teachers");
        setTeachers(teachersRes.data);
      } catch (err) {
        const message = err.response?.data?.error || "Failed to load teacher data";
        loadErrors.push(message);
      }

      try {
        const sectionsRes = await API.get("/sections");
        setSections(sectionsRes.data);
      } catch (err) {
        const message = err.response?.data?.error || "Failed to load section data";
        loadErrors.push(message);
      }

      if (loadErrors.length) {
        alert(loadErrors.join("\n"));
      }
    };

    loadData();
  }, []);

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

  return (
    <div>
      <h3>Add Subject</h3>

      <input
        placeholder="Name"
        value={name}
        onChange={(e) => setName(e.target.value)}
      />
      <input
        placeholder="Code"
        value={code}
        onChange={(e) => setCode(e.target.value)}
      />

      <select value={type} onChange={(e) => setType(e.target.value)}>
        <option value="theory">Theory</option>
        <option value="lab">Lab</option>
      </select>

      <input
        type="number"
        min="1"
        placeholder="Weekly Slots"
        value={weeklySlots}
        onChange={(e) => setWeeklySlots(e.target.value)}
      />

      <select
        value={selectedTeacher}
        onChange={(e) => setSelectedTeacher(e.target.value)}
      >
        <option value="">Select Teacher</option>
        {teachers.map(t => (
          <option key={t._id} value={t._id}>{t.name}</option>
        ))}
      </select>

      <select value={sectionId} onChange={(e) => setSectionId(e.target.value)}>
        <option value="">Select Section</option>
        {sections.map(s => (
          <option key={s._id} value={s._id}>{s.name}</option>
        ))}
      </select>

      <button onClick={handleSubmit}>Add</button>
    </div>
  );
}