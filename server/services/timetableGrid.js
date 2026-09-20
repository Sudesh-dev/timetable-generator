const DAYS = 6;
const SLOTS = 9;

function isGrid(value) {
  return (
    Array.isArray(value) &&
    value.length === DAYS &&
    value.every((day) => Array.isArray(day) && day.length === SLOTS)
  );
}

function normalizeGrid(value) {
  let grid = value;

  while (Array.isArray(grid) && grid.length === 1 && !isGrid(grid)) {
    grid = grid[0];
  }

  if (!isGrid(grid)) return [];
  return grid;
}

function getCellEntries(cell) {
  if (!cell) return [];
  if (!Array.isArray(cell)) return typeof cell === "object" ? [cell] : [];
  return cell.flat(Infinity).filter((entry) => entry && typeof entry === "object");
}

function withNormalizedGrid(timetable) {
  if (!timetable) return timetable;
  const value =
    typeof timetable.toObject === "function" ? timetable.toObject() : timetable;
  return { ...value, grid: normalizeGrid(value.grid) };
}

module.exports = { normalizeGrid, getCellEntries, withNormalizedGrid };
