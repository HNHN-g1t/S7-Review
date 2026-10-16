// イチニノサンダー（ウォール6で習得）。
// [1]・[2]・[3] が 1-2-3 の順に上下左右でつながると有効になり、サイが黄色く光る。
// 光ったサイを1→2→3と指を離さずなぞると「イチ、ニノ（タメ）、サンダー！」の合図で、
// 離れたランダム2列にイナヅマが落ちる。フィーバー中は4列（隣接可）。
export type Pos = { x: number; y: number };
type Grid = ReadonlyArray<ReadonlyArray<{ value: number } | null>>;

const NEIGHBORS = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
] as const;

/** 盤面で最初に見つかった 1-2-3 のつながり（[1]の位置, [2]の位置, [3]の位置）。なければ null */
export function findThunderSet(board: Grid): [Pos, Pos, Pos] | null {
  const rows = board.length;
  const cols = board[0]?.length ?? 0;
  const at = (x: number, y: number) => (x >= 0 && y >= 0 && x < cols && y < rows ? board[y][x]?.value : undefined);
  // 下の段から探す（目に入りやすい、積み上がった側を優先）
  for (let y = rows - 1; y >= 0; y -= 1) {
    for (let x = 0; x < cols; x += 1) {
      if (at(x, y) !== 2) continue;
      for (const [ax, ay] of NEIGHBORS) {
        if (at(x + ax, y + ay) !== 1) continue;
        for (const [bx, by] of NEIGHBORS) {
          if (at(x + bx, y + by) === 3) {
            return [
              { x: x + ax, y: y + ay },
              { x, y },
              { x: x + bx, y: y + by },
            ];
          }
        }
      }
    }
  }
  return null;
}

/** イナヅマが落ちる列。通常は離れた2列、フィーバー中は4列。盤面の端からはみ出さない */
// 2026-10-07：盤面の縦の列からランダムに3本、となり合わないようにバラバラに選ぶ。
// FEVER中は5本（となり合ってもよい）。rand は確認用に差し替えられる
// 2026-10-08：強すぎたので、通常2本・FEVER中4本に減らした（ユーザー指示）
export function thunderColumns(cols: number, fever: boolean, rand: () => number = Math.random): number[] {
  const want = Math.min(cols, fever ? 4 : 2);
  for (let attempt = 0; attempt < 200; attempt += 1) {
    const order = Array.from({ length: cols }, (_, x) => x).sort(() => rand() - 0.5);
    const picked: number[] = [];
    for (const x of order) {
      if (picked.length === want) break;
      if (fever || picked.every((p) => Math.abs(p - x) > 1)) picked.push(x);
    }
    if (picked.length === want) return picked.sort((a, b) => a - b);
  }
  return Array.from({ length: want }, (_, i) => i * 2).filter((x) => x < cols);
}
