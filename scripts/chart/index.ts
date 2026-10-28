// The Info menu's Chart, drawn from the game's own files: GRAPH.DAT record 25
// in the sepia palette, with a colour-13 box over every uncharted cell, as
// MAIN.EXE 0x22D09 draws it (game-details/at-sea.md#charted-areas-and-known-ports).
// Three states: a new game's 130 cells, every cell a fleet can chart, and the
// whole map. The cells a fleet can chart come from a flood fill of the world
// map (game-details/fame/adventure-fame.md#cartography).
import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { decodeGraphRecord, readGraphRecords } from "../art/graph-format.js";
import { readPaletteAt } from "../draw-world-map/tilesets.js";
import {
  combineWorldMaps,
  generateWorldMaps,
} from "../draw-world-map/world-map.js";
import { prepareOutput, repoRoot, writeJson, writePng } from "../shared.js";

const raw = join(repoRoot, "raw");

// The chart grid: 90 × 45 cells of 24 × 24 tiles.
const COLUMNS = 90;
const ROWS = 45;
const CELL_TILES = 24;
const WORLD_WIDTH = COLUMNS * CELL_TILES;
// ports.json and world-map.bin put save X 0 at map X 720.
const SAVE_X_OFFSET = 720;
// Tiles numbered 0x34 or above are impassable (MAIN.EXE 0x36E6C).
const FIRST_IMPASSABLE = 0x34;
// A new game charts columns 4–16 of rows 8–17 (MAIN.EXE 0x1B90A).
const START = { columns: [4, 16], rows: [8, 17] } as const;
// The overview: cells of 6 × 6 pixels from (50, 50), the first screen column
// being chart column 90 − 30 (DS:0x08D7), uncharted ones boxed in colour 13,
// faded in to the sepia palette at DS:0xAB3E.
const CHART_RECORD = 25;
const CELL_PIXELS = 6;
const ORIGIN = 50;
const FIRST_COLUMN = COLUMNS - 30;
const UNCHARTED_COLOUR = 13;
const SEPIA_PALETTE = 0xab3e;

const cellIndex = (column: number, row: number) => row * COLUMNS + column;

function startingCells(): Set<number> {
  const cells = new Set<number>();
  for (let column = START.columns[0]; column <= START.columns[1]; column++)
    for (let row = START.rows[0]; row <= START.rows[1]; row++)
      cells.add(cellIndex(column, row));
  return cells;
}

/**
 * Every cell a fleet can chart: flood-fill the positions where its 2 × 2
 * block is all passable, one tile in any direction with the map wrapping east
 * to west, from the sea off Lisbon, and chart each position's cell and its
 * eight neighbours. An upper bound: it allows every diagonal step the block
 * fits through and ignores the window clamping at the map parts' edges.
 */
function chartableCells(tiles: Uint8Array, height: number): Set<number> {
  const passable = (x: number, y: number) =>
    tiles[y * WORLD_WIDTH + ((x + WORLD_WIDTH) % WORLD_WIDTH)]! <
    FIRST_IMPASSABLE;
  const fits = (x: number, y: number) =>
    y >= 0 &&
    y + 1 < height &&
    passable(x, y) &&
    passable(x + 1, y) &&
    passable(x, y + 1) &&
    passable(x + 1, y + 1);

  // The sea off Lisbon (map X 840, Y 358).
  const start = { x: 838, y: 358 };
  if (!fits(start.x, start.y)) throw new Error("No sea off Lisbon");
  const seen = new Uint8Array(WORLD_WIDTH * height);
  const queue = new Int32Array(WORLD_WIDTH * height * 2);
  let head = 0;
  let tail = 0;
  seen[start.y * WORLD_WIDTH + start.x] = 1;
  queue[tail++] = start.x;
  queue[tail++] = start.y;
  const cells = startingCells();
  while (head < tail) {
    const x = queue[head++]!;
    const y = queue[head++]!;
    const column = Math.floor(
      ((x - SAVE_X_OFFSET + WORLD_WIDTH) % WORLD_WIDTH) / CELL_TILES,
    );
    const row = Math.floor(y / CELL_TILES);
    for (let dc = -1; dc <= 1; dc++)
      for (let dr = -1; dr <= 1; dr++)
        if (row + dr >= 0 && row + dr < ROWS)
          cells.add(cellIndex((column + dc + COLUMNS) % COLUMNS, row + dr));
    for (let dx = -1; dx <= 1; dx++)
      for (let dy = -1; dy <= 1; dy++) {
        const nx = (x + dx + WORLD_WIDTH) % WORLD_WIDTH;
        const ny = y + dy;
        if ((dx || dy) && ny >= 0 && ny < height) {
          const index = ny * WORLD_WIDTH + nx;
          if (!seen[index] && fits(nx, ny)) {
            seen[index] = 1;
            queue[tail++] = nx;
            queue[tail++] = ny;
          }
        }
      }
  }
  return cells;
}

/** The overview with every cell not in `charted` boxed over. */
function drawChart(
  background: Uint8Array,
  width: number,
  boxColour: readonly number[],
  charted: Set<number> | "all",
): Uint8Array {
  const pixels = Uint8Array.from(background);
  if (charted === "all") return pixels;
  for (let screenColumn = 0; screenColumn < COLUMNS; screenColumn++) {
    const column = (FIRST_COLUMN + screenColumn) % COLUMNS;
    for (let row = 0; row < ROWS; row++) {
      if (charted.has(cellIndex(column, row))) continue;
      for (let dy = 0; dy < CELL_PIXELS; dy++)
        for (let dx = 0; dx < CELL_PIXELS; dx++) {
          const x = ORIGIN + screenColumn * CELL_PIXELS + dx;
          const y = ORIGIN + row * CELL_PIXELS + dy;
          pixels.set(boxColour, (y * width + x) * 3);
        }
    }
  }
  return pixels;
}

export async function run(): Promise<void> {
  const output = await prepareOutput("chart");
  const [parts, exe, graph] = await Promise.all([
    generateWorldMaps(raw),
    readFile(join(raw, "MAIN.EXE")),
    readFile(join(raw, "GRAPH.DAT")),
  ]);
  const world = combineWorldMaps(parts);
  if (world.columns !== WORLD_WIDTH)
    throw new Error(`Unexpected world width ${world.columns}`);

  const start = startingCells();
  const chartable = chartableCells(world.data, world.rows);
  await writeJson(join(output, "chartable-cells.json"), {
    total: COLUMNS * ROWS,
    atStart: start.size,
    chartable: chartable.size,
    paidAtMost: chartable.size - start.size,
    cells: [...chartable].sort((a, b) => a - b),
  });

  const sepia = readPaletteAt(exe, SEPIA_PALETTE);
  const record = readGraphRecords(graph)[CHART_RECORD];
  if (!record) throw new Error(`GRAPH.DAT has no record ${CHART_RECORD}`);
  const image = decodeGraphRecord(record, sepia);
  const box = sepia[UNCHARTED_COLOUR]!;
  for (const [name, charted] of [
    ["chart-start", start],
    ["chart-chartable", chartable],
    ["chart-complete", "all"],
  ] as const)
    await writePng(
      join(output, `${name}.png`),
      drawChart(image.pixels, image.width, box, charted),
      image.width,
      image.height,
      3,
    );
  console.log(
    `${chartable.size} of ${COLUMNS * ROWS} cells chartable, ${start.size} at the start`,
  );
}

await run();
