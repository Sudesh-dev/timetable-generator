import { useEffect, useState } from "react";
import API from "../api/api";
import TimetableGrid from "../components/TimetableGrid";

export default function GeneratePage() {
  const [sections, setSections] = useState([]);
  const [sectionId, setSectionId] = useState("");
  const [timetable, setTimetable] = useState(null);
  const [loading, setLoading] = useState(false);

  // load sections
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

  // generate timetable
  const generate = async () => {
    if (!sectionId) {
      alert("Please select a section");
      return;
    }

    try {
      setLoading(true);

      const res = await API.post("/timetable/generate", {
        sectionId,
        classroom: "CSLH-001",
        roomPool: [
          { name: "Lab 1" },
          { name: "Lab 2" }
        ],
      });

      console.log("API RESPONSE:", res.data);

      // 🔥 SAFE FIX FOR ANY RESPONSE STRUCTURE
      const tt = res.data.timetable;

      if (!tt) {
        alert("No timetable returned");
        setTimetable(null);
        return;
      }

      // if backend returns raw grid
      if (Array.isArray(tt)) {
        setTimetable({ grid: tt });
      }
      // if backend returns object with grid
      else if (tt.grid) {

        let fixedGrid = tt.grid;

        if (Array.isArray(tt.grid) && tt.grid.length === 1 && Array.isArray(tt.grid[0])) {
          fixedGrid = tt.grid[0];
        }

        setTimetable({ ...tt, grid: fixedGrid });
      }
      else {
        alert("Invalid timetable format");
        setTimetable(null);
      }

    } catch (err) {
      const message =
        err.response?.data?.error || "Failed to generate timetable";
      alert(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>

      <h1 style={{ marginBottom: "20px" }}>Generate Timetable</h1>

      <div className="card">

        <select
          value={sectionId}
          onChange={(e) => setSectionId(e.target.value)}
        >
          <option value="">Select Section</option>
          {sections.map((s) => (
            <option key={s._id} value={s._id}>
              {s.name}
            </option>
          ))}
        </select>

        <button onClick={generate}>
          {loading ? "Generating..." : "Generate"}
        </button>

      </div>

      {/* SAFE RENDER */}
      {timetable?.grid?.length > 0 && (
        <div className="card">
          <TimetableGrid data={timetable.grid} />
        </div>
      )}

    </div>
  );
}