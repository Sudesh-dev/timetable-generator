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

  useEffect(() => {
    loadData();
    fetchSubjects();
  }, []);

  const loadData = async () => {
    const t = await API.get("/teachers");
    const s = await API.get("/sections");
    setTeachers(t.data);
    setSections(s.data);
  };

  const fetchSubjects = async () => {
    const res = await API.get("/subjects");
    setSubjectsList(res.data);
  };

  const handleSubmit = async () => {
    await API.post("/subjects", {
      name,
      code,
      type,
      weeklySlots,
      sectionId,
      semester, // ✅ added
      allowedTeachers: [selectedTeacher]
    });

    fetchSubjects();

    setName("");
    setCode("");
    setWeeklySlots("");
    setSelectedTeacher("");
  };

  const handleDelete = async (id) => {
    await API.delete(`/subjects/${id}`);
    fetchSubjects();
  };

  const handleEdit = (s) => {
    setName(s.name);
    setCode(s.code);
    setType(s.type);
    setWeeklySlots(s.weeklySlots);
    setSectionId(s.sectionId?._id || s.sectionId);
    setSelectedTeacher(s.allowedTeachers?.[0]?._id || s.allowedTeachers?.[0]);
    setSemester(s.semester || ""); // ✅
  };

  const filteredSubjects = subjectsList.filter((s) => {
    const subjectSectionId = String(s.sectionId?._id || s.sectionId || "");
    const subjectSemester = String(s.sectionId?.semester || "");

    const sectionMatch = !filterSection || subjectSectionId === String(filterSection);
    const semesterMatch = !filterSemester || subjectSemester === String(filterSemester);

    return sectionMatch && semesterMatch;
  });

  const disabled = !sectionId; // ✅ KEY FIX
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
            onChange={(e)=>setSemester(e.target.value)}
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
          >
            <option value="">Select Section</option>
            {sections.map(s=>(
              <option key={s._id} value={s._id}>{s.name}</option>
            ))}
          </select>

        </div>

        {noSections && (
          <div className="empty-state inline-empty">No sections found. Add a section first.</div>
        )}

        {noTeachers && (
          <div className="empty-state inline-empty">No teachers found. Add a professor first.</div>
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

        <button disabled={disabled} onClick={handleSubmit} style={button}>
          ➕ Add Subject
        </button>
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