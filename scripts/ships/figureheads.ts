import { mkdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { decodePlanar, writePng } from "../shared.js";

// The ten figurehead pictures the Ship card draws beside the ship
// (game-details/fleet-info.md): 48 × 48, four planes interleaved a byte at
// a time with the first plane as the colour's lowest bit, in TRANSIT.DAT at
// 0x1980 + 0x480 × n for figurehead n (1-based, the Shipyard menu's order),
// in the Info palette at DS:0xAB6E.

export const FIGUREHEADS = [
  "Sea Horse",
  "Commodore",
  "Unicorn",
  "Lion",
  "Giant Eagle",
  "Hero",
  "Neptune",
  "Dragon",
  "Angel",
  "Goddess",
];

const SIZE = 48;
const DATA_SEGMENT = 0x3657;
const INFO_PALETTE = 0xab6e;

/** A 0–15 palette channel as the VGA DAC shows it: 6 bits, scaled to 8. */
function channel(value: number): number {
  const dac = value << 2;
  return (dac << 2) | (dac >> 4);
}

/** The Info palette, stored as blue, red, green per colour. */
function infoPalette(exe: Buffer): number[][] {
  const start = exe.readUInt16LE(8) * 16 + DATA_SEGMENT * 16 + INFO_PALETTE;
  return Array.from({ length: 16 }, (_, colour) => {
    const [blue, red, green] = exe.subarray(
      start + colour * 3,
      start + colour * 3 + 3,
    );
    return [channel(red!), channel(green!), channel(blue!)];
  });
}

/** Writes figurehead-01.png … figurehead-10.png into `directory`. */
export async function writeFigureheads(
  transitPath: string,
  mainExePath: string,
  directory: string,
): Promise<void> {
  const [transit, exe] = await Promise.all([
    readFile(transitPath),
    readFile(mainExePath),
  ]);
  // decodePlanar reads the first plane as the highest bit; these images
  // store it as the lowest, so look each value up with its bits reversed.
  const info = infoPalette(exe);
  const reversed = (value: number) =>
    ((value & 1) << 3) | ((value & 2) << 1) | ((value & 4) >> 1) | (value >> 3);
  const palette = info.map((_, value) => info[reversed(value)]!);
  const bytes = (SIZE * SIZE * 4) / 8;
  await mkdir(directory, { recursive: true });
  for (let n = 1; n <= FIGUREHEADS.length; n++) {
    const start = 0x1980 + bytes * n;
    const { data } = decodePlanar(
      transit.subarray(start, start + bytes),
      8,
      4,
      palette,
    );
    await writePng(
      join(directory, `figurehead-${String(n).padStart(2, "0")}.png`),
      data,
      SIZE,
      SIZE,
      3,
    );
  }
}
