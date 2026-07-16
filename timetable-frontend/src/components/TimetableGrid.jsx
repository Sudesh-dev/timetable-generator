import React from "react";

const DAYS = ["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];

const SLOT_LABELS = [
  "09:00-09:50",
  "09:50-10:40",
  "BREAK",
  "11:00-11:50",
  "11:50-12:40",
  "LUNCH",
  "01:20-02:10",
  "02:10-03:00",
  "03:00-03:50"
];

function getCellKey(cell) {
  if (!cell || typeof cell !== "object") return "";
  return cell.blockId || cell.subjectId || cell.subjectName || "";
}

export default function TimetableGrid({ data }) {
  const safeData = Array.isArray(data) ? data : [];

  function getSpan(day, startIndex) {
    const cell = day[startIndex];

    if (!cell || typeof cell !== "object") return 1;

    const key = getCellKey(cell);
    let span = 1;

    for (let i = startIndex + 1; i < day.length; i++) {
      const next = day[i];

      if (!next || typeof next !== "object") break;
      if (getCellKey(next) !== key) break;

      span++;
    }

    return span;
  }

  function renderCell(cell) {
    if (!cell || typeof cell !== "object") return "";
    return <div>{cell.subjectName || ""}</div>;
  }

  return (
    <div className="stack" style={{ background:"#ffffff", color:"#000000", padding:12 }}>
      <div style={{ textAlign:"center", marginBottom:20 }}>
        <h2>APS College of Engineering</h2>
        <h4>Timetable</h4>
      </div>

      <div className="table-wrap">
        <table style={{
          width:"100%",
          borderCollapse:"collapse",
          tableLayout:"fixed"
        }}>
          <thead>
            <tr>
              <th style={th}>DAY</th>
              {SLOT_LABELS.map((s,i)=>(
                <th key={i} style={th}>{s}</th>
              ))}
            </tr>
          </thead>

          <tbody>
            {safeData.map((dayRaw,dIndex)=>{
              const day = Array.isArray(dayRaw) ? dayRaw : [];
              let skip = 0;

              return (
                <tr key={dIndex}>
                  <td style={tdBold}>{DAYS[dIndex]}</td>

                  {SLOT_LABELS.map((_,sIndex)=>{
                    const cell = day[sIndex] || null;

                    if (skip > 0) {
                      skip--;
                      return null;
                    }

                    if (sIndex===2 && dIndex===0) {
                      return <td key={sIndex} rowSpan={6} style={breakStyle}>B<br/>R<br/>E<br/>A<br/>K</td>;
                    }
                    if (sIndex===2) return null;

                    if (sIndex===5 && dIndex===0) {
                      return <td key={sIndex} rowSpan={6} style={lunchStyle}>L<br/>U<br/>N<br/>C<br/>H</td>;
                    }
                    if (sIndex===5) return null;

                    const span = getSpan(day, sIndex);

                    if (span > 1) {
                      skip = span - 1;
                    }

                    return (
                      <td key={sIndex} colSpan={span} style={td}>
                        {renderCell(cell)}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div style={{ marginTop:30 }}>
        <h3 style={{ textAlign:"center" }}>Faculty Mapping</h3>

        <div className="table-wrap">
          <table style={{
            width:"100%",
            borderCollapse:"collapse",
            marginTop:10
          }}>
            <thead>
              <tr>
                <th style={th}>Subject</th>
                <th style={th}>Faculty</th>
              </tr>
            </thead>

            <tbody>
              {extractFaculty(safeData).map((row, i)=>(
                <tr key={i}>
                  <td style={td}>{row.subject}</td>
                  <td style={td}>{row.teacher}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function extractFaculty(data) {
  const map = {};

  data.forEach(day => {
    if (!Array.isArray(day)) return;

    day.forEach(cell => {
      if (!cell || typeof cell !== "object") return;

      if (cell.subjectName && !map[cell.subjectName]) {
        map[cell.subjectName] = cell.teacherName || "Faculty";
      }
    });
  });

  return Object.keys(map).map(key => ({
    subject: key,
    teacher: map[key]
  }));
}

const th = {
  border:"1px solid #aaa",
  padding:6,
  fontSize:"11px",
  background:"#ffffff"
};

const td = {
  border:"1px solid #aaa",
  padding:6,
  fontSize:"11px",
  wordWrap:"break-word",
  verticalAlign:"middle"
};

const tdBold = {
  ...td,
  fontWeight:"bold"
};

const breakStyle = {
  border:"1px solid #aaa",
  textAlign:"center",
  verticalAlign:"middle",
  fontWeight:"bold"
};

const lunchStyle = {
  border:"1px solid #aaa",
  textAlign:"center",
  verticalAlign:"middle",
  fontWeight:"bold"
};
