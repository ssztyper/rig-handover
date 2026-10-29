import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';

const config = { adapter: 'shim', installed: '2026-10-29T14:06:00+01:00', beatEverySeconds: 60, runsDir: 'runs' };

describe('status board', () => {
  it('shows the lane banner and the nights on disk', async () => {
    process.env.LANE_MARKER = 'TEST-MARKER';
    const res = await createApp(config).request('/');
    const html = await res.text();
    expect(res.status).toBe(200);
    expect(html).toContain('TEST-MARKER');
    expect(html).toContain('2026-10-28');
  });

  it('links each night to its digest with counts', async () => {
    const html = await (await createApp(config).request('/')).text();
    expect(html).toContain('href="/digest/2026-10-28"');
    expect(html).toContain('href="/digest/2026-10-27"');
    const lines = readFileSync('runs/2026-10-28.jsonl', 'utf8').split('\n');
    const n = { ok: 0, retry: 0, fail: 0 };
    for (const l of lines) {
      const m = /"status":"(ok|retry|fail)"/.exec(l);
      if (!m) continue;
      try {
        JSON.parse(l);
      } catch {
        continue;
      }
      n[m[1] as 'ok' | 'retry' | 'fail'] += 1;
    }
    expect(html).toContain(`ok ${n.ok} · retry ${n.retry} · fail ${n.fail}`);
  });

  it('health answers with the lane id', async () => {
    const res = await createApp(config).request('/health');
    expect(await res.json()).toEqual({ ok: true, lane: 'lane-07' });
  });
});
