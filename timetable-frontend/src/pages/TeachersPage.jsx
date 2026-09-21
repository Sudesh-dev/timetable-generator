import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import API from "../api/api";
import Modal from "../components/Modal";

export default function TeachersPage() {
  const navigate = useNavigate();
  const [teachers, setTeachers] = useState([]);
  const [name, setName] = useState("");
  const [teacherId, setTeacherId] = useState("");
  const [editing, setEditing] = useState(null);

  const load = async () => {
    const res = await API.get("/teachers");
    setTeachers(res.data);
  };

  useEffect(() => {
    let active = true;

    API.get("/teachers")
      .then((res) => {
        if (active) setTeachers(res.data);
      })
      .catch(() => {
        if (active) alert("Failed to load teachers");
      });

    return () => {
      active = false;
    };
  }, []);

  const addTeacher = async () => {
    if (!name.trim()) {
      alert("Name is required");
      return;
    }

    try {
      await API.post("/teachers", { name: name.trim(), teacherId: teacherId.trim() });
      setName("");
      setTeacherId("");
      await load();
    } catch {
      alert("Failed to add teacher");
    }
  };

  const updateTeacher = async () => {
    if (!editing?.name?.trim()) {
      alert("Name is required");
      return;
    }

    try {
      await API.put(`/teachers/${editing._id}`, {
        name: editing.name.trim(),
        teacherId: (editing.teacherId || "").trim(),
      });
      setEditing(null);
      await load();
    } catch {
      alert("Failed to update teacher");
    }
  };

  const deleteTeacher = async (id) => {
    try {
      await API.delete(`/teachers/${id}`);
      await load();
    } catch {
      alert("Failed to delete teacher");
    }
  };

  return (
    <div className="page-shell content-narrow">
      <div className="page-actions">
        <button className="btn-secondary" onClick={() => navigate("/")}>Back to Home</button>
      </div>

      <div className="card">
        <div className="card-header">
          <h2>Manage Teachers</h2>
          <p className="muted">Create, update, and remove teacher records from one place.</p>
        </div>

        <div className="form-grid">
          <label className="form-field">
            <span>Teacher Name</span>
            <input placeholder="Enter teacher name" value={name} onChange={e=>setName(e.target.value)} />
          </label>
          <label className="form-field">
            <span>Teacher ID</span>
            <input placeholder="Enter teacher ID" value={teacherId} onChange={e=>setTeacherId(e.target.value)} />
          </label>
          <div className="form-action">
            <button onClick={addTeacher}>Add Teacher</button>
          </div>
        </div>

        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>#</th><th>Name</th><th>ID</th><th>Actions</th></tr>
            </thead>
            <tbody>
              {teachers.length === 0 ? (
                <tr>
                  <td colSpan="4">
                    <div className="empty-state">No teachers added yet.</div>
                  </td>
                </tr>
              ) : (
                teachers.map((t,i)=>(
                  <tr key={t._id}>
                    <td>{i+1}</td>
                    <td>{t.name}</td>
                    <td>{t.teacherId || "-"}</td>
                    <td>
                      <div className="button-row">
                        <button className="btn-secondary" onClick={()=>setEditing(t)}>Edit</button>
                        <button className="btn-danger" onClick={()=>deleteTeacher(t._id)}>Delete</button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <Modal isOpen={!!editing} onClose={()=>setEditing(null)}>
          <h3>Edit Teacher</h3>
          <label className="form-field">
            <span>Teacher Name</span>
            <input
              value={editing?.name || ""}
              onChange={(e)=>setEditing({...editing, name:e.target.value})}
            />
          </label>
          <label className="form-field">
            <span>Teacher ID</span>
            <input
              value={editing?.teacherId || ""}
              onChange={(e)=>setEditing({...editing, teacherId:e.target.value})}
            />
          </label>
          <button onClick={updateTeacher}>Save</button>
        </Modal>
      </div>
    </div>
  );
}
