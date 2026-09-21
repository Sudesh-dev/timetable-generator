import { useEffect, useState } from "react";
import API from "../api/api";

/* styles (unchanged) */
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

export default function SubjectForm() {

  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [type, setType] = useState("theory");
  const [weeklySlots, setWeeklySlots] = useState("");

  const [teachers, setTeachers] = useState([]);
  const [selectedTeacher, setSelectedTeacher] = useState("");

  const [sections, setSections] = useState([]);
  const [sectionId, setSectionId] = useState("");

  const [semester, setSemester] = useState(""); // ✅ NEW

  const [subjectsList, setSubjectsList] = useState([]);
  const [filterSemester, setFilterSemester] = useState("");
  const [filterSection, setFilterSection] = useState("");
  const [editingId, setEditingId] = useState(null);

  const fetchSubjects = async () => {
    const res = await API.get("/subjects");
    setSubjectsList(res.data);
  };

  useEffect(() => {
    let active = true;

    Promise.all([
      API.get("/teachers"),
      API.get("/sections"),
      API.get("/subjects"),
    ])
      .then(([teacherResponse, sectionResponse, subjectResponse]) => {
        if (!active) return;
        setTeachers(teacherResponse.data);
        setSections(sectionResponse.data);
        setSubjectsList(subjectResponse.data);
      })
      .catch(() => {
        if (active) alert("Failed to load subject setup data");
      });

    return () => {
      active = false;
    };
  }, []);

  const resetForm = () => {
    setName("");
    setCode("");
    setType("theory");
    setWeeklySlots("");
    setSelectedTeacher("");
    setEditingId(null);
  };

  const handleSubmit = async () => {
    const parsedWeeklySlots = Number(weeklySlots);

    if (!name.trim() || !code.trim()) {
      alert("Subject name and code are required");
      return;
    }

    if (!sectionId || !selectedTeacher) {
      alert("Select a section and teacher");
      return;
    }

    if (!Number.isInteger(parsedWeeklySlots) || parsedWeeklySlots < 1) {
      alert("Weekly slots must be a positive integer");
      return;
    }

    if (type === "lab" && parsedWeeklySlots % 2 !== 0) {
      alert("Lab weekly slots must be divisible by the 2-period lab duration");
      return;
    }

    const payload = {
      name: name.trim(),
      code: code.trim(),
      type,
      weeklySlots: parsedWeeklySlots,
      sectionId,
      allowedTeachers: [selectedTeacher],
    };

    try {
      if (editingId) {
        await API.put(`/subjects/${editingId}`, payload);
      } else {
        await API.post("/subjects", payload);
      }

      await fetchSubjects();
      resetForm();
    } catch (err) {
      alert(err.response?.data?.error || "Failed to save subject");
    }
  };

  const handleDelete = async (id) => {
    try {
      await API.delete(`/subjects/${id}`);
      await fetchSubjects();
      if (editingId === id) resetForm();
    } catch (err) {
      alert(err.response?.data?.error || "Failed to delete subject");
    }
  };

  const handleEdit = (s) => {
    setEditingId(s._id);
    setName(s.name);
    setCode(s.code);
    setType(s.type);
    setWeeklySlots(s.weeklySlots);
    setSectionId(s.sectionId?._id || s.sectionId);
    setSelectedTeacher(s.allowedTeachers?.[0]?._id || s.allowedTeachers?.[0]);
    setSemester(String(s.sectionId?.semester || ""));
  };

  const filteredSubjects = subjectsList.filter((s) => {
    const subjectSectionId = String(s.sectionId?._id || s.sectionId || "");
    const subjectSemester = String(s.sectionId?.semester || "");

    const sectionMatch = !filterSection || subjectSectionId === String(filterSection);
    const semesterMatch = !filterSemester || subjectSemester === String(filterSemester);

    return sectionMatch && semesterMatch;
  });

  const disabled = !semester || !sectionId;
  const noTeachers = teachers.length === 0;
  const noSections = sections.length === 0;

  return (
    <div className="content-narrow stack">

      <h2>📘 Subject Management</h2>

      <div className="card">

        <h3>Add Subject</h3>

        {/* ✅ DROPDOWNS FIRST */}
        <div className="form-grid">

          <select
            value={semester}
            onChange={(e) => {
              setSemester(e.target.value);
              setSectionId("");
            }}
            style={input}
          >
            <option value="">Select Semester</option>
            {[1,2,3,4,5,6,7,8].map(s=>(
              <option key={s} value={s}>{s}</option>
            ))}
          </select>

          <select
            value={sectionId}
            onChange={(e)=>setSectionId(e.target.value)}
            style={input}
            disabled={!semester}
          >
            <option value="">Select Section</option>
            {sections
              .filter((s) => String(s.semester) === String(semester))
              .map((s) => (
                <option key={s._id} value={s._id}>{s.name}</option>
              ))}
          </select>

        </div>

        {noSections && (
          <div className="empty-state inline-empty">No sections found. Add a section first.</div>
        )}

        {noTeachers && (
          <div className="empty-state inline-empty">No teachers found. Add a teacher first.</div>
        )}

        {/* ✅ FORM (DISABLED UNTIL SECTION SELECTED) */}
        <div className="form-grid" style={{ opacity: disabled ? 0.5 : 1 }}>

          <input disabled={disabled} placeholder="Name" value={name}
            onChange={(e) => setName(e.target.value)} style={input} />

          <input disabled={disabled} placeholder="Code" value={code}
            onChange={(e) => setCode(e.target.value)} style={input} />

          <select disabled={disabled} value={type}
            onChange={(e) => setType(e.target.value)} style={input}>
            <option value="theory">Theory</option>
            <option value="lab">Lab</option>
          </select>

          <input disabled={disabled} type="number" placeholder="Weekly Slots"
            value={weeklySlots}
            onChange={(e) => setWeeklySlots(e.target.value)} style={input} />

          <select disabled={disabled} value={selectedTeacher}
            onChange={(e) => setSelectedTeacher(e.target.value)} style={input}>
            <option value="">Select Teacher</option>
            {teachers.map(t => (
              <option key={t._id} value={t._id}>{t.name}</option>
            ))}
          </select>

        </div>

        <div className="button-row">
          <button disabled={disabled} onClick={handleSubmit} style={button}>
            {editingId ? "Save Subject Changes" : "➕ Add Subject"}
          </button>
          {editingId && (
            <button className="btn-secondary" onClick={resetForm} style={button}>
              Cancel Edit
            </button>
          )}
        </div>
      </div>

      {/* TABLE (UNCHANGED UI) */}
      <div className="card">

        <h3>Saved Subjects</h3>
        <div className="form-grid" style={{ marginBottom: "15px" }}>
          <select
            value={filterSemester}
            onChange={(e) => setFilterSemester(e.target.value)}
            style={input}
          >
            <option value="">All Semesters</option>
            {[1,2,3,4,5,6,7,8].map((sem) => (
              <option key={sem} value={sem}>{sem}</option>
            ))}
          </select>

          <select
            value={filterSection}
            onChange={(e) => setFilterSection(e.target.value)}
            style={input}
          >
            <option value="">All Sections</option>
            {sections
              .filter((s) => !filterSemester || String(s.semester) === String(filterSemester))
              .map((s) => (
                <option key={s._id} value={s._id}>
                  {s.name}
                </option>
              ))}
          </select>
        </div>

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Code</th>
                <th>Type</th>
                <th>Slots</th>
                <th>Section</th>
                <th>Actions</th>
              </tr>
            </thead>

            <tbody>
              {filteredSubjects.length === 0 ? (
                <tr>
                  <td colSpan="6">
                    <div className="empty-state">No subjects to show for the selected filter.</div>
                  </td>
                </tr>
              ) : (
                filteredSubjects.map((s) => (
                  <tr key={s._id}>
                    <td>{s.name}</td>
                    <td>{s.code}</td>
                    <td>{s.type}</td>
                    <td>{s.weeklySlots}</td>
                    <td>{s.sectionId?.name || "N/A"}</td>
                    <td>
                      <div className="button-row">
                        <button className="btn-secondary" onClick={() => handleEdit(s)}>Edit</button>
                        <button className="btn-danger" onClick={() => handleDelete(s._id)}>Delete</button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

      </div>
    </div>
  );
}
