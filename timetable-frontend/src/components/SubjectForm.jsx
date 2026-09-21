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

  const [semester, setSemester] = useState("");

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

      <h2>Subject Management</h2>

      <div className="card">
        <div className="card-header">
          <h3>{editingId ? "Edit Subject" : "Add Subject"}</h3>
          <p className="muted">Choose a semester and section before entering subject details.</p>
        </div>

        <div className="form-section">
          <div className="form-grid form-grid-two">
            <label className="form-field">
              <span>Semester</span>
              <select
                value={semester}
                onChange={(e) => {
                  setSemester(e.target.value);
                  setSectionId("");
                }}
              >
                <option value="">Select semester</option>
                {[1,2,3,4,5,6,7,8].map(s=>(
                  <option key={s} value={s}>Semester {s}</option>
                ))}
              </select>
            </label>

            <label className="form-field">
              <span>Section</span>
              <select
                value={sectionId}
                onChange={(e)=>setSectionId(e.target.value)}
                disabled={!semester}
              >
                <option value="">Select section</option>
                {sections
                  .filter((s) => String(s.semester) === String(semester))
                  .map((s) => (
                    <option key={s._id} value={s._id}>{s.name}</option>
                  ))}
              </select>
            </label>
          </div>
        </div>

        {noSections && (
          <div className="empty-state inline-empty">No sections found. Add a section first.</div>
        )}

        {noTeachers && (
          <div className="empty-state inline-empty">No teachers found. Add a teacher first.</div>
        )}

        <div className="form-section">
          <div className={`form-grid ${disabled ? "disabled-fields" : ""}`}>
            <label className="form-field">
              <span>Subject Name</span>
              <input disabled={disabled} placeholder="Enter subject name" value={name}
                onChange={(e) => setName(e.target.value)} />
            </label>

            <label className="form-field">
              <span>Subject Code</span>
              <input disabled={disabled} placeholder="Enter subject code" value={code}
                onChange={(e) => setCode(e.target.value)} />
            </label>

            <label className="form-field">
              <span>Subject Type</span>
              <select disabled={disabled} value={type}
                onChange={(e) => setType(e.target.value)}>
                <option value="theory">Theory</option>
                <option value="lab">Lab</option>
              </select>
            </label>

            <label className="form-field">
              <span>Weekly Slots</span>
              <input disabled={disabled} type="number" min="1" placeholder="Enter weekly slots"
                value={weeklySlots}
                onChange={(e) => setWeeklySlots(e.target.value)} />
            </label>

            <label className="form-field">
              <span>Assigned Teacher</span>
              <select disabled={disabled} value={selectedTeacher}
                onChange={(e) => setSelectedTeacher(e.target.value)}>
                <option value="">Select teacher</option>
                {teachers.map(t => (
                  <option key={t._id} value={t._id}>{t.name}</option>
                ))}
              </select>
            </label>
          </div>
        </div>

        <div className="form-actions">
          <button disabled={disabled} onClick={handleSubmit}>
            {editingId ? "Save Subject Changes" : "Add Subject"}
          </button>
          {editingId && (
            <button className="btn-secondary" onClick={resetForm}>
              Cancel Edit
            </button>
          )}
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <h3>Saved Subjects</h3>
          <p className="muted">Filter subjects by semester or section.</p>
        </div>
        <div className="form-grid form-grid-two filter-row">
          <label className="form-field">
            <span>Semester Filter</span>
            <select
              value={filterSemester}
              onChange={(e) => {
                setFilterSemester(e.target.value);
                setFilterSection("");
              }}
            >
              <option value="">All semesters</option>
              {[1,2,3,4,5,6,7,8].map((sem) => (
                <option key={sem} value={sem}>Semester {sem}</option>
              ))}
            </select>
          </label>

          <label className="form-field">
            <span>Section Filter</span>
            <select
              value={filterSection}
              onChange={(e) => setFilterSection(e.target.value)}
            >
              <option value="">All sections</option>
              {sections
                .filter((s) => !filterSemester || String(s.semester) === String(filterSemester))
                .map((s) => (
                  <option key={s._id} value={s._id}>
                    {s.name}
                  </option>
                ))}
            </select>
          </label>
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
