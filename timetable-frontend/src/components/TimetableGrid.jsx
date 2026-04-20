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

export default function TimetableGrid({ data }) {

  // 🔥 MERGE LOGIC
  function getSpan(day, startIndex) {
    const cell = day[startIndex];
    if (!cell || cell.type !== "lab") return 1;

    let span = 1;

    for (let i = startIndex + 1; i < day.length; i++) {
      const next = day[i];
      if (!next || next.subjectId !== cell.subjectId) break;
      span++;
    }

    return span;
  }

  function renderCell(cell) {
    if (!cell) return "";

    if (Array.isArray(cell)) {
      return cell.map((c, i) => (
        <div key={i}>
          {c.subjectName} ({c.batch}) - {c.room}
        </div>
      ));
    }

    return (
      <div>
        {cell.subjectName}
      </div>
    );
  }

  return (
    <div style={{ background:"#ffffff", color:"#000000", padding:20 }}>

      {/* HEADER */}
      <div style={{ textAlign:"center", marginBottom:20 }}>
        <h2 >APS College of Engineering</h2>
        
        <h4>Timetable</h4>
      </div>

      <div style={{ overflowX:"auto" }}>
        <table style={{
          width:"100%",
          minWidth:"1200px",
          borderCollapse:"collapse"
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
            {data.map((day,dIndex)=>{

              let skip = 0;

              return (
                <tr key={dIndex}>

                  <td style={tdBold}>{DAYS[dIndex]}</td>

                  {day.map((cell,sIndex)=>{

                    if (skip > 0) {
                      skip--;
                      return null;
                    }

                    // BREAK
                    if (sIndex===2 && dIndex===0) {
                      return <td rowSpan={6} style={breakStyle}>B<br/>R<br/>E<br/>A<br/>K</td>;
                    }
                    if (sIndex===2) return null;

                    // LUNCH
                    if (sIndex===5 && dIndex===0) {
                      return <td rowSpan={6} style={lunchStyle}>L<br/>U<br/>N<br/>C<br/>H</td>;
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

      {/* 🔥 FACULTY TABLE */}
      <div style={{ marginTop:30 }}>
        <h3 style={{ textAlign:"center" }}>Faculty Mapping</h3>

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
            {extractFaculty(data).map((row, i)=>(
              <tr key={i}>
                <td style={td}>{row.subject}</td>
                <td style={td}>{row.teacher}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

    </div>
  );
}

/* 🔥 EXTRACT SUBJECT → FACULTY */
function extractFaculty(data) {
  const map = {};

  data.forEach(day => {
    day.forEach(cell => {
      if (!cell) return;

      const entries = Array.isArray(cell) ? cell : [cell];

      entries.forEach(e => {
        if (!map[e.subjectName]) {
          map[e.subjectName] = e.teacherName;
        }
      });
    });
  });

  return Object.keys(map).map(key => ({
    subject: key,
    teacher: map[key]
  }));
}

/* styles */

const th = {
  border:"1px solid #aaa",
  padding:8,
  background:"#ffffff"
};

const td = {
  border:"1px solid #aaa",
  padding:8,
  minWidth:90
};

const tdBold = {
  ...td,
  background:"#ffffff",
  fontWeight:"bold"
};

const breakStyle = {
  border:"1px solid #aaa",
  background:"#ffffff",
  textAlign:"center"
};

const lunchStyle = {
  border:"1px solid #aaa",
  background:"#ffffff",
  textAlign:"center"
};