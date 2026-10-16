export type You456Point = { x: number; y: number };
export type You456Set = [You456Point, You456Point, You456Point];
type Grid = ReadonlyArray<ReadonlyArray<{ value: number; hyoketsu?: unknown } | null>>;
export type You456Lines = { columns: number[]; rows: number[]; cells: You456Point[] };
export type You456Strike = You456Lines & { used: You456Set };
const neighbors = [[1, 0], [-1, 0], [0, 1], [0, -1]] as const;

// Like 1→2→3, a route may turn a corner but cannot jump or use diagonals.
export function findYou456Set(board: Grid): You456Set | null {
  const at = (x: number, y: number) => {
    const cell = board[y]?.[x];
    return cell && !cell.hyoketsu ? cell.value : undefined;
  };
  for (let y = board.length - 1; y >= 0; y--) {
    for (let x = 0; x < (board[y]?.length ?? 0); x++) {
      if (at(x, y) !== 5) continue;
      for (const [dx, dy] of neighbors) {
        if (at(x + dx, y + dy) !== 4) continue;
        for (const [ex, ey] of neighbors) {
          if (at(x + ex, y + ey) === 6) return [{ x: x + dx, y: y + dy }, { x, y }, { x: x + ex, y: y + ey }];
        }
      }
    }
  }
  return null;
}

// The 4 where the trace starts anchors both axes. At an edge the extra line
// goes inward, so FEVER always has two distinct rows and two distinct columns.
export function you456Lines(width: number, height: number, origin: You456Point, fever: boolean): You456Lines {
  if (width < 1 || height < 1 || !Number.isInteger(origin.x) || !Number.isInteger(origin.y) || origin.x < 0 || origin.x >= width || origin.y < 0 || origin.y >= height) {
    return { columns: [], rows: [], cells: [] };
  }
  const columns = [origin.x], rows = [origin.y];
  if (fever && width > 1) columns.push(origin.x + 1 < width ? origin.x + 1 : origin.x - 1);
  if (fever && height > 1) rows.push(origin.y + 1 < height ? origin.y + 1 : origin.y - 1);
  const cells: You456Point[] = [];
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    if (columns.includes(x) || rows.includes(y)) cells.push({ x, y });
  }
  return { columns, rows, cells };
}

export function you456PracticeCells(): Array<[number, number, number]> {
  const cells: Array<[number, number, number]> = [];
  for (let y = 12; y < 14; y++) for (let x = 0; x < 7; x++) cells.push([x, y, x % 2 ? 4 : 2]);
  cells.push([2, 11, 4], [3, 11, 5], [4, 11, 6], [6, 11, -2], [2, 9, -1]);
  return cells;
}
