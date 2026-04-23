import { useEffect, useState } from "react";
import API from "../api/api";
import TimetableGrid from "../components/TimetableGrid";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";

export default function GeneratePage() {
  const [sections, setSections] = useState([]);
  const [sectionId, setSectionId] = useState("");
  const [subjects, setSubjects] = useState([]);
  const [timetable, setTimetable] = useState(null);
  const [loading, setLoading] = useState(false);

  const [previewImg, setPreviewImg] = useState(null);
  const [showPreview, setShowPreview] = useState(false);

  // LOAD SECTIONS
  useEffect(() => {
    API.get("/sections")
      .then(res => setSections(res.data))
      .catch(() => alert("Failed to load sections"));
  }, []);

  // FETCH SUBJECTS WHEN SECTION SELECTED
  useEffect(() => {
    if (!sectionId) return;

    API.get("/subjects")
      .then(res => {
        const filtered = res.data.filter(
          s => String(s.sectionId?._id || s.sectionId) === String(sectionId)
        );
        setSubjects(filtered);
      })
      .catch(() => alert("Failed to load subjects"));
  }, [sectionId]);

  // GENERATE TIMETABLE
  const generate = async () => {
    if (!sectionId) {
      alert("Select section first");
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
    <div style={{ maxWidth: "1000px", margin: "auto" }}>

      <h1>Generate Timetable</h1>

      {/* SECTION SELECT */}
      <div className="card">
        <select
          value={sectionId}
          onChange={(e) => setSectionId(e.target.value)}
        >
          <option value="">Select Section</option>
          {sections.map(s => (
            <option key={s._id} value={s._id}>{s.name}</option>
          ))}
        </select>

        <button onClick={generate}>
          {loading ? "Generating..." : "Generate"}
        </button>
      </div>

      {/* SUBJECT TABLE */}
      {subjects.length > 0 && (
        <div className="card">
          <h3>Subjects & Teachers</h3>

          <table style={{ width: "100%" }}>
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
      )}

      {/* 🔥 ONLY THIS IS CAPTURED */}
      {timetable?.grid?.length > 0 && (
        <>
          <div id="timetable-area">

            <div className="card">
              <TimetableGrid data={timetable.grid} />
            </div>

          </div>

          {/* BUTTONS OUTSIDE (NOT IN PDF) */}
          <div style={{ textAlign: "center", marginTop: "20px" }}>
            <button onClick={previewPDF} style={{ marginRight: "10px" }}>
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
        <div style={{
          position: "fixed",
          top: 0,
          left: 0,
          width: "100%",
          height: "100%",
          background: "rgba(0,0,0,0.7)",
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          zIndex: 999
        }}>
          <div style={{
            background: "#fff",
            padding: "20px",
            borderRadius: "10px",
            maxWidth: "90%",
            maxHeight: "90%",
            overflow: "auto"
          }}>
            <h3>PDF Preview</h3>

            <img
              src={previewImg}
              alt="preview"
              style={{ width: "100%" }}
            />

            <div style={{ textAlign: "right", marginTop: "10px" }}>
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