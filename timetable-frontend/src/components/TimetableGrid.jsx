export default function TimetableGrid({ data }) {
  const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const safeData = Array.isArray(data) ? data : [];

  return (
    <table border="1">
      <thead>
        <tr>
          <th>Day</th>
          {[1,2,3,4,5,6,7].map(s => <th key={s}>Slot {s}</th>)}
        </tr>
      </thead>

      <tbody>
        {safeData.map((day, dIndex) => (
          <tr key={dIndex}>
            <td>{days[dIndex]}</td>

            {(Array.isArray(day) ? day : []).map((cell, sIndex) => (
              <td key={sIndex}>
                {cell ? (
                  Array.isArray(cell) ? (
                    cell.map((c, i) => (
                      <div key={i}>
                        {c.subjectName} ({c.batch || ""})
                      </div>
                    ))
                  ) : (
                    <div>
                      {cell.subjectName}
                    </div>
                  )
                ) : "-"}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}