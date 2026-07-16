import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import API from "../api/api";
import TimetableGrid from "../components/TimetableGrid";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";

export default function GeneratePage() {
  const navigate = useNavigate();
  const [sections, setSections] = useState([]);
  const [semester, setSemester] = useState("");
  const [sectionId, setSectionId] = useState("");
  const [allSubjects, setAllSubjects] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [timetable, setTimetable] = useState(null);
  const [loading, setLoading] = useState(false);

  const [previewImg, setPreviewImg] = useState(null);
  const [showPreview, setShowPreview] = useState(false);

  const handleBack = () => {
    if (window.history.length > 1) {
      navigate(-1);
      return;
    }
    navigate("/");
  };

  // LOAD SECTIONS + SUBJECTS
  useEffect(() => {
    API.get("/sections")
      .then(res => setSections(res.data))
      .catch(() => alert("Failed to load sections"));

    API.get("/subjects")
      .then(res => setAllSubjects(res.data))
      .catch(() => alert("Failed to load subjects"));
  }, []);

  // RESET SECTION + RESULTS WHEN SEMESTER CHANGES
  useEffect(() => {
    setSectionId("");
    setSubjects([]);
    setTimetable(null);
  }, [semester]);

  // FILTER SUBJECTS FOR SELECTED SEMESTER + SECTION
  useEffect(() => {
    if (!semester || !sectionId) {
      setSubjects([]);
      return;
    }

    const filtered = allSubjects.filter(
      (s) =>
        String(s.sectionId?._id || s.sectionId) === String(sectionId) &&
        String(s.sectionId?.semester || "") === String(semester)
    );

    setSubjects(filtered);
  }, [semester, sectionId, allSubjects]);

  // GENERATE TIMETABLE
  const generate = async () => {
    if (!semester || !sectionId) {
      alert("Select semester and section first");
      return;
    }

    if (subjects.length === 0) {
      alert("No subjects available for the selected semester/section");
      return;
    }

    try {
      setLoading(true);

      const res = await API.post("/timetable/generate", {
        sectionId,
        classroom: "CSLH-001",
        roomPool: [{ name: "Lab 1" }, { name: "Lab 2" }]
      });

      let tt = res.data.timetable;

      if (Array.isArray(tt)) {
        setTimetable({ grid: tt });
      } else if (tt.grid) {
        let fixedGrid = tt.grid;

        if (tt.grid.length === 1 && Array.isArray(tt.grid[0])) {
          fixedGrid = tt.grid[0];
        }

        setTimetable({ ...tt, grid: fixedGrid });
      }

    } catch (err) {
      alert(err.response?.data?.error || "Failed");
    } finally {
      setLoading(false);
    }
  };

  // 🔥 CAPTURE FULL CONTENT (NO CROP)
  const captureFull = async () => {
    const element = document.getElementById("timetable-area");

    const originalHeight = element.style.height;
    const originalOverflow = element.style.overflow;

    element.style.height = "auto";
    element.style.overflow = "visible";

    const canvas = await html2canvas(element, {
      scale: 2,
      useCORS: true,
      windowWidth: element.scrollWidth,
      windowHeight: element.scrollHeight
    });

    element.style.height = originalHeight;
    element.style.overflow = originalOverflow;

    return canvas;
  };

  // PREVIEW
  const previewPDF = async () => {
    const canvas = await captureFull();
    const imgData = canvas.toDataURL("image/png");

    setPreviewImg(imgData);
    setShowPreview(true);
  };

  // DOWNLOAD
  const downloadPDF = async () => {
    const canvas = await captureFull();
    const imgData = canvas.toDataURL("image/png");

    const pdf = new jsPDF("landscape", "mm", "a4");

    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();

    const imgWidth = pageWidth;
    const imgHeight = (canvas.height * imgWidth) / canvas.width;

    let position = 0;

    while (position < imgHeight) {
      pdf.addImage(imgData, "PNG", 0, -position, imgWidth, imgHeight);
      position += pageHeight;

      if (position < imgHeight) pdf.addPage();
    }

    pdf.save("timetable.pdf");
  };

  return (
    <div className="page-shell content-narrow">

      <div className="page-actions">
        <button className="btn-secondary" onClick={handleBack}>Back</button>
      </div>

      <h1>Generate Timetable</h1>

      <div className="card">
        <div className="form-grid">
          <select
            value={semester}
            onChange={(e) => setSemester(e.target.value)}
          >
            <option value="">Select Semester</option>
            {[1,2,3,4,5,6,7,8].map((sem) => (
              <option key={sem} value={sem}>Semester {sem}</option>
            ))}
          </select>

          <select
            value={sectionId}
            onChange={(e) => {
              setSectionId(e.target.value);
              setTimetable(null);
            }}
            disabled={!semester}
          >
            <option value="">Select Section</option>
            {sections
              .filter((s) => !semester || String(s.semester) === String(semester))
              .map((s) => (
                <option key={s._id} value={s._id}>{s.name}</option>
              ))}
          </select>

          <button disabled={!semester || !sectionId || subjects.length === 0 || loading} onClick={generate}>
            {loading ? "Generating..." : "Generate"}
          </button>
        </div>

        {semester && sectionId && subjects.length === 0 && (
          <div className="empty-state">No subjects found for this semester and section.</div>
        )}
      </div>

      {semester && sectionId && subjects.length > 0 && (
        <div className="card">
          <h3>Subjects & Teachers</h3>

          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Subject</th>
                  <th>Code</th>
                  <th>Teacher</th>
                </tr>
              </thead>

              <tbody>
                {subjects.map(s => (
                  <tr key={s._id}>
                    <td>{s.name}</td>
                    <td>{s.code}</td>
                    <td>{s.allowedTeachers?.[0]?.name || "Assigned"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {semester && sectionId && subjects.length > 0 && timetable?.grid?.length > 0 && (
        <>
          <div id="timetable-area">

            <div className="card">
              <TimetableGrid data={timetable.grid} />
            </div>

          </div>

          <div className="actions-center">
            <button onClick={previewPDF}>
              👁 Preview PDF
            </button>

            <button onClick={downloadPDF}>
              📄 Download PDF
            </button>
          </div>
        </>
      )}

      {/* PREVIEW MODAL */}
      {showPreview && (
        <div className="preview-modal">
          <div className="preview-card">
            <h3>PDF Preview</h3>

            <img src={previewImg} alt="preview" />

            <div className="align-right">
              <button onClick={() => setShowPreview(false)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}