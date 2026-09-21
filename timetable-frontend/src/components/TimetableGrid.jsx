import { useState } from "react";

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

const TEACHING_SLOTS = new Set([0, 1, 3, 4, 6, 7, 8]);

function getCellKey(cell) {
  if (!cell || typeof cell !== "object") return "";
  return cell.blockId || cell.subjectId || cell.subjectName || "";
}

function cellsBelongToSameBlock(first, second) {
  const firstKey = getCellKey(first);
  return Boolean(firstKey) && firstKey === getCellKey(second);
}

function getEntries(cell) {
  if (!cell || typeof cell !== "object") return [];
  if (Array.isArray(cell)) return cell.flatMap(getEntries);
  if (Array.isArray(cell.parallelSessions)) {
    return cell.parallelSessions.flatMap(getEntries);
  }
  return [cell];
}

function getSubjectLabel(cell) {
  return [
    ...new Set(
      getEntries(cell)
        .map((entry) => entry.subjectName)
        .filter(Boolean)
    ),
  ].join(" / ");
}

function formatWorkingDate(value) {
  if (!value) return "Not selected";
  const [year, month, day] = value.split("-");
  return year && month && day ? `${day}/${month}/${year}` : value;
}

function getBlock(grid, dayIndex, slotIndex) {
  const day = grid[dayIndex] || [];
  const cell = day[slotIndex];
  if (!cell) return null;

  let start = slotIndex;
  let end = slotIndex;

  while (
    TEACHING_SLOTS.has(start - 1) &&
    cellsBelongToSameBlock(day[start - 1], cell)
  ) {
    start--;
  }

  while (
    TEACHING_SLOTS.has(end + 1) &&
    cellsBelongToSameBlock(day[end + 1], cell)
  ) {
    end++;
  }

  return {
    day: dayIndex,
    start,
    length: end - start + 1,
    cells: day.slice(start, end + 1),
  };
}

function destinationSlots(start, length) {
  return Array.from({ length }, (_, offset) => start + offset);
}

function moveOrSwapBlock(data, sourcePosition, targetPosition) {
  const source = getBlock(data, sourcePosition.day, sourcePosition.slot);
  if (!source) return { error: "Only occupied timetable slots can be moved." };

  const sourceSlots = destinationSlots(source.start, source.length);
  const targetSlots = destinationSlots(targetPosition.slot, source.length);

  if (targetSlots.some((slot) => !TEACHING_SLOTS.has(slot))) {
    return { error: "A class block cannot cross the break, lunch, or end of day." };
  }

  if (
    source.day === targetPosition.day &&
    targetSlots.some((slot) => sourceSlots.includes(slot))
  ) {
    return { error: "Drop the class into a different timetable slot." };
  }

  const targetCells = targetSlots.map(
    (slot) => data[targetPosition.day]?.[slot] || null
  );
  const occupiedTargets = targetCells.filter(Boolean);
  let target = null;

  if (occupiedTargets.length > 0) {
    target = getBlock(data, targetPosition.day, targetPosition.slot);
    if (!target || target.length !== source.length) {
      return {
        error: "Classes can only be swapped with another block of the same length.",
      };
    }

    const actualTargetSlots = destinationSlots(target.start, target.length);
    if (
      target.start !== targetPosition.slot ||
      actualTargetSlots.some((slot, index) => slot !== targetSlots[index]) ||
      targetCells.some((cell) => !cellsBelongToSameBlock(cell, target.cells[0]))
    ) {
      return {
        error: "Drop on the first period of a class block to swap it.",
      };
    }
  }

  const nextGrid = data.map((day) => (Array.isArray(day) ? day.slice() : []));
  sourceSlots.forEach((slot) => {
    nextGrid[source.day][slot] = null;
  });

  if (target) {
    targetSlots.forEach((slot) => {
      nextGrid[target.day][slot] = null;
    });
    target.cells.forEach((cell, offset) => {
      nextGrid[source.day][source.start + offset] = cell;
    });
  }

  source.cells.forEach((cell, offset) => {
    nextGrid[targetPosition.day][targetPosition.slot + offset] = cell;
  });

  return { grid: nextGrid };
}

export default function TimetableGrid({
  data,
  subjects = [],
  workingPeriod = {},
  editable = false,
  onGridChange,
  onInvalidMove,
}) {
  const safeData = Array.isArray(data) ? data : [];
  const [dragSource, setDragSource] = useState(null);
  const [dropTarget, setDropTarget] = useState(null);
  const [selectedSource, setSelectedSource] = useState(null);

  const moveClass = async (source, target) => {
    const result = moveOrSwapBlock(safeData, source, target);

    if (result.error) {
      onInvalidMove?.(result.error);
      return false;
    }

    const accepted = await onGridChange?.(result.grid);
    if (accepted !== false) setSelectedSource(null);
    return accepted !== false;
  };

  const startDragging = (event, day, slot) => {
    if (!editable) return;
    setDragSource({ day, slot });
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", `${day}:${slot}`);
  };

  const dropClass = async (event, day, slot) => {
    event.preventDefault();
    setDropTarget(null);

    if (!editable || !dragSource) return;

    const source = dragSource;
    setDragSource(null);
    await moveClass(source, { day, slot });
  };

  const selectOrMoveClass = async (day, slot, cell) => {
    if (!editable) return;

    if (!selectedSource) {
      if (!cell) {
        onInvalidMove?.("Select an occupied class first, then select its destination.");
        return;
      }
      const block = getBlock(safeData, day, slot);
      setSelectedSource({ day, slot: block?.start ?? slot });
      return;
    }

    if (selectedSource.day === day && selectedSource.slot === slot) {
      setSelectedSource(null);
      return;
    }

    await moveClass(selectedSource, { day, slot });
  };

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
    return <div>{getSubjectLabel(cell)}</div>;
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

                    const isDropTarget =
                      dropTarget?.day === dIndex && dropTarget?.slot === sIndex;
                    const isSelected =
                      selectedSource?.day === dIndex &&
                      selectedSource?.slot === sIndex;

                    return (
                      <td
                        key={sIndex}
                        colSpan={span}
                        style={{
                          ...td,
                          ...(editable && cell ? draggableCellStyle : {}),
                          ...(isDropTarget ? dropTargetStyle : {}),
                          ...(isSelected ? selectedCellStyle : {}),
                        }}
                        draggable={editable && Boolean(cell)}
                        onDragStart={(event) => startDragging(event, dIndex, sIndex)}
                        onDragEnd={() => {
                          setDragSource(null);
                          setDropTarget(null);
                        }}
                        onDragOver={(event) => {
                          if (!editable || !dragSource) return;
                          event.preventDefault();
                          event.dataTransfer.dropEffect = "move";
                        }}
                        onDragEnter={() => {
                          if (editable && dragSource) {
                            setDropTarget({ day: dIndex, slot: sIndex });
                          }
                        }}
                        onDrop={(event) => dropClass(event, dIndex, sIndex)}
                        onClick={() => selectOrMoveClass(dIndex, sIndex, cell)}
                        title={
                          editable
                            ? cell
                              ? "Drag this class, or click it and then click a destination"
                              : selectedSource
                                ? "Move the selected class here"
                                : "Select an occupied class first"
                            : undefined
                        }
                      >
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
        <h3 style={{ textAlign:"center" }}>Subject Details</h3>

        <div className="table-wrap">
          <table style={{
            width:"100%",
            borderCollapse:"collapse",
            marginTop:10
          }}>
            <thead>
              <tr>
                <th style={th}>Subject</th>
                <th style={th}>Code</th>
                <th style={th}>Faculty</th>
              </tr>
            </thead>

            <tbody>
              {extractSubjectDetails(safeData, subjects).map((row)=>(
                <tr key={`${row.subject}-${row.code}`}>
                  <td style={td}>{row.subject}</td>
                  <td style={td}>{row.code}</td>
                  <td style={td}>{row.teacher}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="table-wrap">
        <table style={{ width:"100%", borderCollapse:"collapse", marginTop:10 }}>
          <tbody>
            <tr>
              <th style={th}>Start Working Day</th>
              <td style={td}>{formatWorkingDate(workingPeriod.startDate)}</td>
              <th style={th}>Last Working Day</th>
              <td style={td}>{formatWorkingDate(workingPeriod.endDate)}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

function extractSubjectDetails(data, subjects) {
  const subjectCodes = new Map(
    subjects.map((subject) => [String(subject._id), subject.code || "-"])
  );
  const map = new Map();

  data.forEach(day => {
    if (!Array.isArray(day)) return;

    day.forEach(cell => {
      getEntries(cell).forEach((entry) => {
        if (!entry.subjectName) return;

        const subjectId = String(entry.subjectId || entry.subjectName);
        if (!map.has(subjectId)) {
          map.set(subjectId, {
            subject: entry.subjectName,
            code: entry.subjectCode || subjectCodes.get(subjectId) || "-",
            teachers: new Set(),
          });
        }

        if (entry.teacherName) map.get(subjectId).teachers.add(entry.teacherName);
      });
    });
  });

  return [...map.values()]
    .map((row) => ({
      subject: row.subject,
      code: row.code,
      teacher: [...row.teachers].join(", ") || "Faculty",
    }))
    .sort((first, second) => first.code.localeCompare(second.code));
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

const draggableCellStyle = {
  cursor: "grab",
  background: "#f0f9ff",
  userSelect: "none",
};

const dropTargetStyle = {
  outline: "3px solid #0f6f8d",
  outlineOffset: "-3px",
  background: "#dff3f8",
};

const selectedCellStyle = {
  outline: "3px solid #b54708",
  outlineOffset: "-3px",
  background: "#fff3e0",
};
