// The forty sea event tiles for the site's map (game-details/at-sea.md#sea-events):
// the ten a new game starts with (DATA1.015, the same offsets as a save
// slot's) and the thirty queued in MONSTER.DAT that replace them in turn.
import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { prepareOutput, repoRoot, writeJson } from "../shared.js";

const EVENTS = [
  "Sirens",
  "Kraken",
  "Vanishing ship",
  "Manta ray",
  "St. Elmo's fire",
  "Phoenix",
  "Tornado",
  "Dragon",
  "Whales",
  "Ghost ship",
];
const ACTIVE = 10;
const ACTIVE_POSITIONS = 0x036e;
const ACTIVE_TYPES = 0x0396;
const QUEUE_RECORD = 5;

/** Save X to world-map X: the map starts 720 tiles further west. */
const mapX = (x: number) => (x >= 1440 ? x - 1440 : x + 720);

export async function run(): Promise<void> {
  const output = await prepareOutput("sea-events");
  const [start, queue] = await Promise.all([
    readFile(join(repoRoot, "raw/DATA1/DATA1.015")),
    readFile(join(repoRoot, "raw/MONSTER.DAT")),
  ]);
  const tiles: { x: number; y: number; event: string; queued: boolean }[] = [];
  for (let index = 0; index < ACTIVE; index++)
    tiles.push({
      x: mapX(start.readUInt16LE(ACTIVE_POSITIONS + index * 4)),
      y: start.readUInt16LE(ACTIVE_POSITIONS + index * 4 + 2),
      event: EVENTS[start[ACTIVE_TYPES + index]!]!,
      queued: false,
    });
  // The queue ends where the records turn to zeros.
  for (
    let offset = 0;
    offset + QUEUE_RECORD <= queue.length;
    offset += QUEUE_RECORD
  ) {
    const x = queue.readUInt16LE(offset);
    const y = queue.readUInt16LE(offset + 2);
    if (x === 0 && y === 0) break;
    tiles.push({
      x: mapX(x),
      y,
      event: EVENTS[queue[offset + 4]!]!,
      queued: true,
    });
  }
  await writeJson(join(output, "sea-events.json"), tiles);
}

if (
  process.argv[1] &&
  import.meta.url === new URL(`file://${process.argv[1]}`).href
)
  await run();
