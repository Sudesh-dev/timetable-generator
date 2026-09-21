import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import API from "../api/api";
import TimetableGrid from "../components/TimetableGrid";

const ROOM_POOL = [{ name: "Lab 1" }, { name: "Lab 2" }];

function normalizeTimetable(value) {
  if (Array.isArray(value)) return { grid: value };
  if (!value?.grid) return null;

  const grid =
    value.grid.length === 1 && Array.isArray(value.grid[0])
      ? value.grid[0]
      : value.grid;
  return { ...value, grid };
}

export default function GeneratePage() {
  const navigate = useNavigate();
  const [sections, setSections] = useState([]);
  const [semester, setSemester] = useState("");
  const [sectionId, setSectionId] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [allSubjects, setAllSubjects] = useState([]);
  const [timetable, setTimetable] = useState(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [validatingMove, setValidatingMove] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [variationSeed, setVariationSeed] = useState(null);

  const [previewImg, setPreviewImg] = useState(null);
  const [showPreview, setShowPreview] = useState(false);
  const savedLoadAbort = useRef(null);

  const subjects = useMemo(() => {
    if (!semester || !sectionId) return [];
    return allSubjects.filter(
      (subject) =>
        String(subject.sectionId?._id || subject.sectionId) === String(sectionId) &&
        String(subject.sectionId?.semester || "") === String(semester)
    );
  }, [semester, sectionId, allSubjects]);

  // LOAD SECTIONS + SUBJECTS
  useEffect(() => {
    API.get("/sections")
      .then(res => setSections(res.data))
      .catch(() => alert("Failed to load sections"));

    API.get("/subjects")
      .then(res => setAllSubjects(res.data))
      .catch(() => alert("Failed to load subjects"));
  }, []);

  const clearTimetable = () => {
    savedLoadAbort.current?.abort();
    setSectionId("");
    setStartDate("");
    setEndDate("");
    setTimetable(null);
    setIsSaved(false);
    setHasUnsavedChanges(false);
    setVariationSeed(null);
    setShowPreview(false);
  };

  // LOAD A PREVIOUSLY SAVED TIMETABLE FOR PREVIEW/DOWNLOAD
  useEffect(() => {
    if (!sectionId) return undefined;

    const controller = new AbortController();
    savedLoadAbort.current = controller;

    API.get(`/timetable/${sectionId}`, { signal: controller.signal })
      .then((res) => {
        if (controller.signal.aborted) return;
        setTimetable(normalizeTimetable(res.data));
        setStartDate(res.data.workingPeriod?.startDate || "");
        setEndDate(res.data.workingPeriod?.endDate || "");
        setIsSaved(true);
        setHasUnsavedChanges(false);
        setVariationSeed(null);
      })
      .catch((err) => {
        if (controller.signal.aborted || err.code === "ERR_CANCELED") return;
        if (err.response?.status === 404) return;
        alert(err.response?.data?.error || "Failed to load saved timetable");
      })
      .finally(() => {
        if (savedLoadAbort.current === controller) {
          savedLoadAbort.current = null;
        }
      });

    return () => controller.abort();
  }, [sectionId]);

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

    if (!startDate || !endDate) {
      alert("Select the start and last working dates");
      return;
    }

    if (endDate < startDate) {
      alert("Last working date must be on or after the start working date");
      return;
    }

    try {
      savedLoadAbort.current?.abort();
      setLoading(true);

      const res = await API.post("/timetable/generate", {
        sectionId,
        classroom: "CSLH-001",
        roomPool: ROOM_POOL,
        workingPeriod: { startDate, endDate },
      });

      setTimetable(normalizeTimetable(res.data.timetable));
      setVariationSeed(res.data.variationSeed);
      setIsSaved(false);
      setHasUnsavedChanges(false);
      setShowPreview(false);

    } catch (err) {
      alert(err.response?.data?.error || "Failed");
    } finally {
      setLoading(false);
    }
  };

  // SAVE THE CURRENT PREVIEW ONLY AFTER EXPLICIT CONFIRMATION
  const saveTimetable = async () => {
    if (!timetable?.grid) {
      alert("Generate or load a timetable before saving");
      return;
    }
    if (!startDate || !endDate || endDate < startDate) {
      alert("Select a valid start and last working date before saving");
      return;
    }

    try {
      setSaving(true);
      const endpoint = hasUnsavedChanges
        ? "/timetable/save-edited"
        : "/timetable/save";
      const payload = {
        sectionId,
        roomPool: ROOM_POOL,
        grid: timetable.grid,
        workingPeriod: { startDate, endDate },
      };

      if (!hasUnsavedChanges) payload.variationSeed = variationSeed;

      const res = await API.post(endpoint, payload);

      setTimetable(normalizeTimetable(res.data.timetable));
      setIsSaved(true);
      setHasUnsavedChanges(false);
      setVariationSeed(null);
      alert("Timetable saved to the database");
    } catch (err) {
      alert(err.response?.data?.error || "Failed to save timetable");
    } finally {
      setSaving(false);
    }
  };

  const updateGrid = async (grid) => {
    try {
      setValidatingMove(true);
      await API.post("/timetable/validate-edited", {
        sectionId,
        roomPool: ROOM_POOL,
        grid,
        workingPeriod: { startDate, endDate },
      });

      setTimetable((current) => ({ ...current, grid }));
      setIsSaved(false);
      setHasUnsavedChanges(true);
      setShowPreview(false);
      return true;
    } catch (err) {
      alert(
        `Move blocked: ${
          err.response?.data?.error ||
          "this slot would break a timetable constraint"
        }`
      );
      return false;
    } finally {
      setValidatingMove(false);
    }
  };

  const updateWorkingDate = (setter, value) => {
    setter(value);
    if (timetable?.grid) {
      setIsSaved(false);
      setHasUnsavedChanges(true);
      setShowPreview(false);
    }
  };

  // 🔥 CAPTURE FULL CONTENT (NO CROP)
  const captureFull = async () => {
    const { default: html2canvas } = await import("html2canvas");
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
    if (!isSaved) {
      alert("Save the timetable to the database before downloading");
      return;
    }

    const canvas = await captureFull();
    const imgData = canvas.toDataURL("image/png");
    const { jsPDF } = await import("jspdf");

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
        <button className="btn-secondary" onClick={() => navigate("/")}>Back to Home</button>
      </div>

      <h1>Generate Timetable</h1>

      <div className="card">
        <div className="card-header">
          <h3>Timetable Details</h3>
          <p className="muted">Select the class and working period before generating.</p>
        </div>

        <div className="form-grid generate-controls">
          <label className="form-field">
            <span>Semester</span>
            <select
              value={semester}
              disabled={validatingMove}
              onChange={(e) => {
                setSemester(e.target.value);
                clearTimetable();
              }}
            >
              <option value="">Select semester</option>
              {[1,2,3,4,5,6,7,8].map((sem) => (
                <option key={sem} value={sem}>Semester {sem}</option>
              ))}
            </select>
          </label>

          <label className="form-field">
            <span>Section</span>
            <select
              value={sectionId}
              onChange={(e) => {
                savedLoadAbort.current?.abort();
                setSectionId(e.target.value);
                setTimetable(null);
                setStartDate("");
                setEndDate("");
                setIsSaved(false);
                setHasUnsavedChanges(false);
                setVariationSeed(null);
                setShowPreview(false);
              }}
              disabled={!semester || validatingMove}
            >
              <option value="">Select section</option>
              {sections
                .filter((s) => !semester || String(s.semester) === String(semester))
                .map((s) => (
                  <option key={s._id} value={s._id}>{s.name}</option>
                ))}
            </select>
          </label>

          <label className="field-label">
            <span>Start Working Day</span>
            <input
              type="date"
              value={startDate}
              disabled={!sectionId || validatingMove}
              onChange={(event) => updateWorkingDate(setStartDate, event.target.value)}
            />
          </label>

          <label className="field-label">
            <span>Last Working Day</span>
            <input
              type="date"
              value={endDate}
              min={startDate || undefined}
              disabled={!sectionId || validatingMove}
              onChange={(event) => updateWorkingDate(setEndDate, event.target.value)}
            />
          </label>

          <div className="form-action">
            <button
              disabled={
                !semester ||
                !sectionId ||
                subjects.length === 0 ||
                !startDate ||
                !endDate ||
                endDate < startDate ||
                loading ||
                validatingMove
              }
              onClick={generate}
            >
              {loading ? "Generating..." : "Generate Timetable"}
            </button>
          </div>
        </div>

        {semester && sectionId && subjects.length === 0 && (
          <div className="empty-state">No subjects found for this semester and section.</div>
        )}
      </div>

      {semester && sectionId && subjects.length > 0 && (
        <div className="card">
          <div className="card-header">
            <h3>Subjects & Teachers</h3>
            <p className="muted">Subjects included in this timetable.</p>
          </div>

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
          <p className="muted edit-instructions">
            Edit manually by clicking a class and then its destination, or drag and drop it.
            Every proposed move is checked before it is applied.
          </p>

          <div id="timetable-area">

            <div className="card">
              <TimetableGrid
                key={`${sectionId}:${variationSeed ?? timetable._id ?? "saved"}`}
                data={timetable.grid}
                subjects={subjects}
                workingPeriod={{ startDate, endDate }}
                editable={!loading && !saving && !validatingMove}
                onGridChange={updateGrid}
                onInvalidMove={(message) => alert(message)}
              />
            </div>

          </div>

          <div className="actions-center">
            <div className="empty-state">
              {validatingMove
                ? "Checking the proposed slot for teacher, room, and timetable clashes..."
                : isSaved
                  ? "Saved in the database — preview and download are available."
                  : hasUnsavedChanges
                    ? "Unsaved changes — save the altered timetable before downloading."
                    : "Preview only — drag a class or click a source and destination to edit, then save before downloading."}
            </div>

            <button
              disabled={
                (isSaved && !hasUnsavedChanges) ||
                saving ||
                loading ||
                validatingMove
              }
              onClick={saveTimetable}
            >
              {saving
                ? "Saving..."
                : isSaved && !hasUnsavedChanges
                  ? "✓ Saved to DB"
                  : hasUnsavedChanges
                    ? "💾 Save Changes to DB"
                    : "💾 Save Timetable to DB"}
            </button>

            <button onClick={previewPDF}>
              👁 Preview PDF
            </button>

            <button
              disabled={!isSaved}
              onClick={downloadPDF}
              title={isSaved ? "Download timetable PDF" : "Save to DB before downloading"}
            >
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
