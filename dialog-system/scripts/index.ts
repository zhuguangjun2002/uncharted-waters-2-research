import { mkdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { repoRoot, writeJson } from "../../scripts/shared.js";
import { writeGeneralMessageCallSites } from "./general-messages.js";
import { analyzeStoryScriptVmExecutable } from "./main-exe.js";
import { writeReadableFormats } from "./readable-formats.js";
import { disassembleStoryScript } from "./snr.js";

interface Message {
  body: string;
  characterId?: string;
  position: number;
}
export async function run(): Promise<void> {
  const output = join(repoRoot, "dialog-system/scripts/output");
  await mkdir(output, { recursive: true });
  const mes = await readFile(join(repoRoot, "raw/SNR1.MES"));
  const messages: Message[] = [];
  let cursor = 4756;
  while (cursor < mes.length) {
    const end = mes.indexOf(0, cursor);
    if (end < 0) break;
    messages.push({
      body: new TextDecoder()
        .decode(mes.subarray(cursor, end))
        .replaceAll("'", "’"),
      position: 0,
    });
    cursor = end + 1;
  }
  const dat = await readFile(join(repoRoot, "raw/SNR1.DAT"));
  cursor = 0;
  while (cursor < dat.length) {
    const first = dat[cursor++]!;
    if (first !== 1 && first !== 2) continue;
    const second = dat[cursor++]!;
    if (second !== 0xcc) {
      cursor--;
      continue;
    }
    if (cursor + 7 > dat.length) break;
    const characterId = dat.readUInt16BE(cursor);
    cursor += 2;
    cursor++;
    const messageId = dat.readUInt16BE(cursor);
    cursor += 2;
    cursor += 2;
    const message = messages[messageId];
    if (message) {
      message.characterId = String(characterId);
      message.position = first;
    }
  }
  for (const message of messages) {
    message.body = message.body.replace(/\|.*?\|\n/g, "");
  }
  await writeJson(join(output, "messages.json"), messages);

  const storyScripts = await Promise.all(
    Array.from({ length: 7 }, async (_, storyScriptId) =>
      disassembleStoryScript(
        storyScriptId,
        await readFile(join(repoRoot, `raw/SNR${storyScriptId}.DAT`)),
        await readFile(join(repoRoot, `raw/SNR${storyScriptId}.MES`)),
      ),
    ),
  );
  await writeJson(join(output, "story-scripts.json"), storyScripts);
  await writeJson(
    join(output, "main-exe-vm.json"),
    analyzeStoryScriptVmExecutable(
      await readFile(join(repoRoot, "raw/MAIN.EXE")),
    ),
  );
  await writeGeneralMessageCallSites(output);
  await writeReadableFormats(output, storyScripts);
}
if (
  process.argv[1] &&
  import.meta.url === new URL(`file://${process.argv[1]}`).href
)
  await run();
