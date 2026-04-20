import { useEffect, useState } from "react";
import API from "../api/api";
import TimetableGrid from "../components/TimetableGrid";

export default function GeneratePage() {
  const [sections, setSections] = useState([]);
  const [sectionId, setSectionId] = useState("");
  const [timetable, setTimetable] = useState(null);

  useEffect(() => {
    const loadSections = async () => {
      try {
        const res = await API.get("/sections");
        setSections(res.data);
      } catch {
        alert("Failed to load sections");
      }
    };

    loadSections();
  }, []);

  const generate = async () => {
    if (!sectionId) {
      alert("Please select a section");
      return;
    }

    try {
      const res = await API.post("/timetable/generate", {
        sectionId,
        classroom: "CSLH-001",
        roomPool: [{ name: "Lab 1" }, { name: "Lab 2" }],
      });

      setTimetable(res.data.timetable);
    } catch (err) {
      const message = err.response?.data?.error || "Failed to generate timetable";
      alert(message);
    }
  };

  return (
    <div>
      <h1>Generate Timetable</h1>

      <select value={sectionId} onChange={(e) => setSectionId(e.target.value)}>
        <option value="">Select Section</option>
        {sections.map(s => (
          <option key={s._id} value={s._id}>{s.name}</option>
        ))}
      </select>

      <button onClick={generate}>Generate</button>

      {timetable && <TimetableGrid data={timetable.grid} />}
    </div>
  );
}