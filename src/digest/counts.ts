import { readFileSync } from 'node:fs';
import { join } from 'node:path';

export type NightCounts = { ok: number; retry: number; fail: number };

// Counts run lines by status. Bad lines are skipped, never thrown. null when the file is missing.
export function nightCounts(runsDir: string, night: string): NightCounts | null {
  let text: string;
  try {
    text = readFileSync(join(runsDir, `${night}.jsonl`), 'utf8');
  } catch {
    return null;
  }
  const counts: NightCounts = { ok: 0, retry: 0, fail: 0 };
  for (const line of text.split('\n')) {
    if (line.trim() === '') continue;
    try {
      const parsed: unknown = JSON.parse(line);
      if (typeof parsed !== 'object' || parsed === null) continue;
      const status = (parsed as { status?: unknown }).status;
      if (status === 'ok' || status === 'retry' || status === 'fail') counts[status] += 1;
    } catch {
      // truncated or malformed line: skipped
    }
  }
  return counts;
}
