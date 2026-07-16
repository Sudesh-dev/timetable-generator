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

  const handleBack = () => {
    if (window.history.length > 1) {
      navigate(-1);
      return;
    }
    navigate("/");
  };

  const load = async () => {
    const res = await API.get("/teachers");
    setTeachers(res.data);
  };

  useEffect(() => { load(); }, []);

  const addTeacher = async () => {
    if (!name.trim()) {
      alert("Name is required");
      return;
    }

    try {
      await API.post("/teachers", { name: name.trim(), teacherId: teacherId.trim() });
      setName("");
      setTeacherId("");
      load();
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
      load();
    } catch {
      alert("Failed to update teacher");
    }
  };

  const deleteTeacher = async (id) => {
    try {
      await API.delete(`/teachers/${id}`);
      load();
    } catch {
      alert("Failed to delete teacher");
    }
  };

  return (
    <div className="page-shell">
      <div className="page-actions">
        <button className="btn-secondary" onClick={handleBack}>Back</button>
      </div>

      <div className="card">
        <h2>Manage Professors</h2>
        <p className="muted">Create, update, and remove faculty records from one place.</p>

        <div className="form-grid">
          <input placeholder="Name" value={name} onChange={e=>setName(e.target.value)} />
          <input placeholder="ID" value={teacherId} onChange={e=>setTeacherId(e.target.value)} />
          <button onClick={addTeacher}>Add</button>
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
                    <div className="empty-state">No professors added yet.</div>
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
          <input
            value={editing?.name || ""}
            onChange={(e)=>setEditing({...editing, name:e.target.value})}
          />
          <input
            value={editing?.teacherId || ""}
            onChange={(e)=>setEditing({...editing, teacherId:e.target.value})}
          />
          <button onClick={updateTeacher}>Save</button>
        </Modal>
      </div>
    </div>
  );
}