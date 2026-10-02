// ICCS → 项目标准 JSONL 转换
// 用法：npx tsx scripts/convert-iccs.ts <输入文件或目录> <输出.jsonl>
// 输入：ICCS 棋谱（PGN 风格标签 + 大写坐标带横线，如 C3-C4），一个文件可含多局
// 输出：JSON Lines，每局一行 {"event","red","black","result","date"?,"fen","moves":[uci,...]}
import { readdirSync, statSync, mkdirSync, createReadStream, createWriteStream } from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';

const DEFAULT_FEN = 'rnbakabnr/9/1c5c1/p1p1p1p1p/9/9/P1P1P1P1P/1C5C1/9/RNBAKABNR w - - 0 1';

const TAG_RE = /^\[(\w+)\s+"(.*)"\]\s*$/;
// ICCS 坐标：列 A-I，横线 0-9，中间以横杠连接，如 C3-C4
const MOVE_RE = /^([A-Ia-i])(\d)-([A-Ia-i])(\d)$/;
const MOVE_NUM_RE = /^\d+\.+$/;
const RESULT_RE = /^(1-0|0-1|1\/2-1\/2|\*)$/;

interface RawGame {
  tags: Record<string, string>;
  moves: string[];
  trailingResult?: string;
}

function collectFiles(input: string): string[] {
  const stat = statSync(input);
  if (stat.isFile()) return [input];
  const files: string[] = [];
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      if (name.startsWith('.')) continue;
      const p = path.join(dir, name);
      const s = statSync(p);
      if (s.isDirectory()) walk(p);
      else files.push(p);
    }
  };
  walk(input);
  return files.sort();
}

// 去代表队前缀：优先按 RedTeam/BlackTeam 标签剥离（"黑龙江 郭莉萍"→"郭莉萍"）；
// 无队伍标签时，全中文且含空白的取最后一段；罗马字姓名（如 "JIN Bo"）原样保留
function stripTeam(name: string, team?: string): string {
  const trimmed = name.trim();
  if (team && team !== '-' && trimmed.startsWith(team) && trimmed.length > team.length) {
    return trimmed.slice(team.length).trim();
  }
  if (/\s/.test(trimmed) && !/[A-Za-z]/.test(trimmed)) {
    const parts = trimmed.split(/\s+/);
    return parts[parts.length - 1];
  }
  return trimmed;
}

function toJson(g: RawGame): string | null {
  if (g.moves.length === 0) return null;
  const fen = g.tags.FEN || DEFAULT_FEN;
  const obj: Record<string, unknown> = {
    event: g.tags.Event ?? '',
    red: g.tags.Red ? stripTeam(g.tags.Red, g.tags.RedTeam) : '',
    black: g.tags.Black ? stripTeam(g.tags.Black, g.tags.BlackTeam) : '',
    result: g.tags.Result ?? g.trailingResult ?? '*',
  };
  if (g.tags.Date && g.tags.Date !== '-') obj.date = g.tags.Date;
  obj.fen = fen;
  obj.moves = g.moves;
  return JSON.stringify(obj);
}

async function convertFile(file: string, out: NodeJS.WritableStream): Promise<{ games: number; skipped: number }> {
  let games = 0;
  let skipped = 0;
  let cur: RawGame = { tags: {}, moves: [] };
  let malformed = false; // 当前局含有无法解析的着法记号，整局丢弃

  const flush = () => {
    if (cur.moves.length === 0 && Object.keys(cur.tags).length === 0) return;
    const line = malformed ? null : toJson(cur);
    if (line) {
      out.write(line + '\n');
      games++;
    } else {
      skipped++;
    }
    cur = { tags: {}, moves: [] };
    malformed = false;
  };

  const rl = readline.createInterface({ input: createReadStream(file), crlfDelay: Infinity });
  let inComment = false; // 跨行 {} 注释
  let tagBuf = ''; // 跨行标签（值内含换行）的缓冲
  for await (const rawLine of rl) {
    const line = rawLine.trim();
    if (!line) continue;
    if (tagBuf) {
      tagBuf += ' ' + line;
      if (line.endsWith('"]')) {
        const m = /^\[(\w+)\s+"(.*)"\]\s*$/.exec(tagBuf);
        if (m) {
          if (cur.moves.length > 0) flush();
          cur.tags[m[1]] = m[2];
        }
        tagBuf = '';
      }
      continue;
    }
    const tag = TAG_RE.exec(line);
    if (tag) {
      // 新标签段开始：若已有着法，说明上一局结束
      if (cur.moves.length > 0) flush();
      cur.tags[tag[1]] = tag[2];
      continue;
    }
    if (line.startsWith('[')) {
      // 标签值跨行（如 Event 内含换行），缓冲到出现结尾 "] 为止
      tagBuf = line;
      continue;
    }
    // 着法区：去 {} 注释与 ; 行注释
    let text = '';
    for (const ch of line) {
      if (inComment) {
        if (ch === '}') inComment = false;
      } else if (ch === '{') {
        inComment = true;
      } else if (ch === ';') {
        break;
      } else {
        text += ch;
      }
    }
    for (const token of text.split(/\s+/)) {
      if (!token || MOVE_NUM_RE.test(token)) continue;
      if (RESULT_RE.test(token)) {
        if (token !== '*') cur.trailingResult = token;
        continue;
      }
      const m = MOVE_RE.exec(token);
      if (!m) {
        malformed = true;
        continue;
      }
      cur.moves.push((m[1] + m[2] + m[3] + m[4]).toLowerCase());
    }
  }
  flush();
  return { games, skipped };
}

async function main() {
  const [input, output] = process.argv.slice(2);
  if (!input || !output) {
    console.error('用法：npx tsx scripts/convert-iccs.ts <输入文件或目录> <输出.jsonl>');
    process.exit(1);
  }
  mkdirSync(path.dirname(output), { recursive: true });
  const files = collectFiles(input);
  const out = createWriteStream(output);
  let games = 0;
  let skipped = 0;
  for (const file of files) {
    const r = await convertFile(file, out);
    games += r.games;
    skipped += r.skipped;
  }
  await new Promise<void>((resolve) => out.end(resolve));
  console.log(`输入文件 ${files.length} 个 → ${output}`);
  console.log(`转换 ${games} 局，跳过 ${skipped} 局（无着法或含无法解析记号）`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
