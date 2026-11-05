// Pictures of the sea screen for the site, from the game's own files: for the
// speed calculator, the sea panel's compass dials (DATA1.014), your fleet's
// sprites (the second half of DATA1.011), and an open-sea tile, in the day
// palette (game-details/at-sea.md#the-sea-screen, #fleet-sprites); the water,
// food, lumber, and shot icons from the sea screen's Cargo panel (GRAPH.DAT
// record 2), for the Harbor's Supply table; and the
// pictures shown when a storm begins, rats come aboard, scurvy breaks out, and
// the game ends at sea (GRAPH.DAT), in the night palette; and the picture for
// a lost naval battle, in the battle palette
// (game-details/naval-battle.md#endings).
import { readFile } from "node:fs/promises";
import { join } from "node:path";

import {
  readPaletteAt,
  readRegularTiles,
  readSeaPalettes,
  type Rgb,
} from "../draw-world-map/tilesets.js";
import { decodeGraphRecord, readGraphRecords } from "../art/graph-format.js";
import { decodePlanar, prepareOutput, repoRoot, writePng } from "../shared.js";

const DIAL_SIZE = 40;
// The dial for direction d (0 north, clockwise) and the empty one for a calm.
const dialOffset = (direction: number) => 0x490 + 0x320 * direction;
const CALM_DIAL = 0x1d90;

// The supply icons, drawn into the sea screen's frame (GRAPH.DAT record 2)
// under its Cargo heading: 16 × 32 cells from (16, 256), one under another.
const SEA_FRAME = 2;
const SUPPLY_ICON = { x: 16, y: 256, width: 16, height: 32 };
const SUPPLIES = ["water", "food", "lumber", "shot"];
const DIRECTIONS = ["n", "ne", "e", "se", "s", "sw", "w", "nw"];

// Fleet sprites: 32 × 32, a mask plane then three colour planes; a set mask
// bit lets the sea show through. Your own fleet's are the first 16: 8 × rig
// (0 oared, 1 sailing) + 2 × pose + frame.
const SPRITE_SIZE = 32;
const RIGS = ["oared", "sailing"];
const POSES = ["north", "east", "south", "west"];
const shipPalette = [
  "000000",
  "00a261",
  "d34100",
  "f3a261",
  "0041d3",
  "00a2f3",
  "d361a2",
  "f3e3d3",
].map((hex) => [...Buffer.from(hex, "hex"), 255]);
const spritePalette = [...shipPalette, [0, 0, 0, 0]];

// Open sea is map tile 0.
const SEA_TILE = 0;

// The GRAPH.DAT records drawn over the sea when a storm is announced, at
// midnight with messages 473 and 474, and with the epilogue when the game ends
// at sea. They use only the first eight colours, the same in every sea
// palette, bar a stray pixel or two.
const EVENT_PICTURES = { storm: 58, rats: 57, scurvy: 59, "game-over": 61 };

// The picture shown when the player's flagship is lost in battle or the
// protagonist loses the duel, and the battle palette it's drawn in. It uses
// entries 8 and 9 as well, so the sea palettes won't do.
const DEFEAT_PICTURE = 56;
const BATTLE_PALETTE = 0xa0f0;

/** A dial from DATA1.014: four planes interleaved per eight pixels,
 * plane 0 first and the most significant bit leftmost. */
function decodePanelPicture(
  data: Buffer,
  offset: number,
  width: number,
  height: number,
  palette: readonly Rgb[],
): Uint8Array {
  const pixels = new Uint8Array(width * height * 3);
  let position = offset;
  for (let y = 0; y < height; y++)
    for (let group = 0; group < width / 8; group++) {
      const planes = data.subarray(position, position + 4);
      position += 4;
      for (let bit = 0; bit < 8; bit++) {
        let colour = 0;
        for (let plane = 0; plane < 4; plane++)
          colour |= ((planes[plane]! >> (7 - bit)) & 1) << plane;
        pixels.set(palette[colour]!, (y * width + group * 8 + bit) * 3);
      }
    }
  return pixels;
}

/** RGBA, with the card colour that reaches the picture's edge made
 * transparent, so an icon sits on any page background. */
function clearBackground(
  rgb: Uint8Array,
  width: number,
  height: number,
): Uint8Array {
  const rgba = new Uint8Array(width * height * 4);
  for (let pixel = 0; pixel < width * height; pixel++) {
    rgba.set(rgb.subarray(pixel * 3, pixel * 3 + 3), pixel * 4);
    rgba[pixel * 4 + 3] = 255;
  }
  const same = (pixel: number) =>
    rgb[pixel * 3] === rgb[0] &&
    rgb[pixel * 3 + 1] === rgb[1] &&
    rgb[pixel * 3 + 2] === rgb[2];
  const stack: number[] = [];
  for (let x = 0; x < width; x++) stack.push(x, (height - 1) * width + x);
  for (let y = 0; y < height; y++) stack.push(y * width, y * width + width - 1);
  while (stack.length) {
    const pixel = stack.pop()!;
    if (rgba[pixel * 4 + 3] === 0 || !same(pixel)) continue;
    rgba[pixel * 4 + 3] = 0;
    const x = pixel % width;
    if (x > 0) stack.push(pixel - 1);
    if (x < width - 1) stack.push(pixel + 1);
    if (pixel >= width) stack.push(pixel - width);
    if (pixel < width * (height - 1)) stack.push(pixel + width);
  }
  return rgba;
}

export async function run(): Promise<void> {
  const output = await prepareOutput("sea-panel");
  const [dials, tiles, graph, { day, night }] = await Promise.all([
    readFile(join(repoRoot, "raw/DATA1/DATA1.014")),
    readFile(join(repoRoot, "raw/DATA1/DATA1.011")),
    readFile(join(repoRoot, "raw/GRAPH.DAT")),
    readSeaPalettes(join(repoRoot, "raw/MAIN.EXE")),
  ]);

  for (const [direction, name] of DIRECTIONS.entries())
    await writePng(
      join(output, `dial-${name}.png`),
      decodePanelPicture(
        dials,
        dialOffset(direction),
        DIAL_SIZE,
        DIAL_SIZE,
        day,
      ),
      DIAL_SIZE,
      DIAL_SIZE,
      3,
    );
  await writePng(
    join(output, "dial-calm.png"),
    decodePanelPicture(dials, CALM_DIAL, DIAL_SIZE, DIAL_SIZE, day),
    DIAL_SIZE,
    DIAL_SIZE,
    3,
  );

  const frame = decodeGraphRecord(readGraphRecords(graph)[SEA_FRAME]!, day);
  for (const [index, name] of SUPPLIES.entries()) {
    const { x, y, width, height } = SUPPLY_ICON;
    const icon = new Uint8Array(width * height * 3);
    for (let row = 0; row < height; row++) {
      const start = ((y + height * index + row) * frame.width + x) * 3;
      icon.set(
        frame.pixels.subarray(start, start + width * 3),
        row * width * 3,
      );
    }
    await writePng(
      join(output, `supply-${name}.png`),
      clearBackground(icon, width, height),
      width,
      height,
      4,
    );
  }

  const sprites = decodePlanar(
    tiles.subarray(tiles.length / 2),
    16,
    4,
    spritePalette,
  ).data;
  const spriteBytes = SPRITE_SIZE * SPRITE_SIZE * 4;
  for (const [rig, rigName] of RIGS.entries())
    for (const [pose, poseName] of POSES.entries())
      for (const frame of [0, 1]) {
        const index = 8 * rig + 2 * pose + frame;
        await writePng(
          join(output, `fleet-${rigName}-${poseName}-${frame}.png`),
          sprites.subarray(index * spriteBytes, (index + 1) * spriteBytes),
          SPRITE_SIZE,
          SPRITE_SIZE,
          4,
        );
      }

  const regular = await readRegularTiles(
    join(repoRoot, "raw/DATA1/DATA1.011"),
    day,
  );
  const tileBytes = 16 * 16 * 3;
  await writePng(
    join(output, "sea.png"),
    regular.subarray(SEA_TILE * tileBytes, (SEA_TILE + 1) * tileBytes),
    16,
    16,
    3,
  );

  const records = readGraphRecords(graph);
  const defeat = decodeGraphRecord(
    records[DEFEAT_PICTURE]!,
    readPaletteAt(
      await readFile(join(repoRoot, "raw/MAIN.EXE")),
      BATTLE_PALETTE,
    ),
  );
  await writePng(
    join(output, "defeat.png"),
    defeat.pixels,
    defeat.width,
    defeat.height,
    3,
  );
  for (const [name, record] of Object.entries(EVENT_PICTURES)) {
    const picture = decodeGraphRecord(records[record]!, night);
    await writePng(
      join(output, `${name}.png`),
      picture.pixels,
      picture.width,
      picture.height,
      3,
    );
  }
}

if (
  process.argv[1] &&
  import.meta.url === new URL(`file://${process.argv[1]}`).href
)
  await run();
