export default function TimetableGrid({ data }) {
  const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  return (
    <table>
      <thead>
        <tr>
          <th>Day</th>
          {[1,2,3,4,5,6,7].map(s => <th key={s}>S{s}</th>)}
        </tr>
      </thead>

      <tbody>
        {data?.map((day, dIndex) => (
          <tr key={dIndex}>
            <td><b>{days[dIndex]}</b></td>

            {day.map((cell, sIndex) => (
              <td key={sIndex}>

                {/* 🔥 SAFE HANDLING */}
                {cell === null ? (
                  <span style={{ color: "#94a3b8" }}>Free</span>
                ) : Array.isArray(cell) ? (
                  cell.map((c, i) => (
                    c ? (
                      <div key={i}>
                        {c.subjectName}
                      </div>
                    ) : null
                  ))
                ) : (
                  <div>
                    {cell?.subjectName || "Free"}
                  </div>
                )}

              </td>
            ))}

          </tr>
        ))}
      </tbody>
    </table>
  );
}