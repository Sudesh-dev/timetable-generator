import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import API from "../api/api";
import Modal from "../components/Modal";

export default function SectionsPage() {
  const navigate = useNavigate();
  const [sections, setSections] = useState([]);
  const [name, setName] = useState("");
  const [semester, setSemester] = useState("");
  const [classroom, setClassroom] = useState("");
  const [editing, setEditing] = useState(null);

  const handleBack = () => {
    if (window.history.length > 1) {
      navigate(-1);
      return;
    }
    navigate("/");
  };

  const load = async () => {
    const res = await API.get("/sections");
    setSections(res.data);
  };

  useEffect(()=>{ load(); }, []);

  const add = async () => {
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
      setName("");
      setSemester("");
      setClassroom("");
      load();
    } catch {
      alert("Failed to add section");
    }
  };

  const update = async () => {
    const parsedSemester = Number(editing?.semester);

    if (!editing?.name?.trim() || !editing?.classroom?.trim()) {
      alert("Name and classroom are required");
      return;
    }

    if (!Number.isInteger(parsedSemester) || parsedSemester <= 0) {
      alert("Semester must be a positive integer");
      return;
    }

    try {
      await API.put(`/sections/${editing._id}`, {
        name: editing.name.trim(),
        semester: parsedSemester,
        classroom: editing.classroom.trim(),
      });
      setEditing(null);
      load();
    } catch {
      alert("Failed to update section");
    }
  };

  const del = async (id) => {
    try {
      await API.delete(`/sections/${id}`);
      load();
    } catch {
      alert("Failed to delete section");
    }
  };

  return (
    <div className="page-shell">
      <div className="page-actions">
        <button className="btn-secondary" onClick={handleBack}>Back</button>
      </div>

      <div className="card">
        <h2>Manage Sections</h2>
        <p className="muted">Each section requires a semester and classroom.</p>

        <div className="form-grid">
          <input value={name} onChange={e=>setName(e.target.value)} placeholder="Section"/>
          <input
            type="number"
            value={semester}
            onChange={e=>setSemester(e.target.value)}
            placeholder="Semester"
          />
          <input
            value={classroom}
            onChange={e=>setClassroom(e.target.value)}
            placeholder="Classroom"
          />
        </div>
        <button onClick={add}>Add</button>

        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>#</th><th>Name</th><th>Semester</th><th>Classroom</th><th>Actions</th></tr>
            </thead>
            <tbody>
              {sections.length === 0 ? (
                <tr>
                  <td colSpan="5">
                    <div className="empty-state">No sections available yet.</div>
                  </td>
                </tr>
              ) : (
                sections.map((s,i)=>(
                  <tr key={s._id}>
                    <td>{i+1}</td>
                    <td>{s.name}</td>
                    <td>{s.semester}</td>
                    <td>{s.classroom}</td>
                    <td>
                      <div className="button-row">
                        <button className="btn-secondary" onClick={()=>setEditing(s)}>Edit</button>
                        <button className="btn-danger" onClick={()=>del(s._id)}>Delete</button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <Modal isOpen={!!editing} onClose={()=>setEditing(null)}>
          <h3>Edit Section</h3>
          <input
            value={editing?.name || ""}
            onChange={(e)=>setEditing({...editing, name:e.target.value})}
          />
          <input
            type="number"
            value={editing?.semester || ""}
            onChange={(e)=>setEditing({...editing, semester:e.target.value})}
          />
          <input
            value={editing?.classroom || ""}
            onChange={(e)=>setEditing({...editing, classroom:e.target.value})}
          />
          <button onClick={update}>Save</button>
        </Modal>
      </div>
    </div>
  );
}