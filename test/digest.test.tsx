import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import type { RigConfig } from '../src/config.js';
import type { Night } from '../src/digest/types.js';

const NORMAL = '2026-10-28';
const EMPTY = '2026-10-27';
const BAD = '2026-10-26';
const MISSING = '2026-10-30';

const goodLines = [
  '{"at":"2026-10-28T23:00:02+01:00","job":"rig/rotate-logs","status":"ok","owner":"lane-07"}',
  '{"at":"2026-10-28T23:00:06+01:00","job":"lane/sync","status":"ok","owner":"rook"}',
  '{"at":"2026-10-29T01:30:00+01:00","job":"fixtures/refresh","status":"retry","owner":"rook","error":"upstream 503"}',
  '{"at":"2026-10-29T01:37:00+01:00","job":"fixtures/refresh","status":"ok","owner":"rook"}',
  '{"at":"2026-10-29T04:00:01+01:00","job":"notes/backup","status":"fail","owner":"lane-07","error":"quota exceeded"}',
  '{"at":"2026-10-29T05:41:09+01:00","job":"digest/render","status":"ok","owner":null}',
];

const JOBS_SORTED = ['digest/render', 'fixtures/refresh', 'lane/sync', 'notes/backup', 'rig/rotate-logs'];

describe('digest routes', () => {
  let dir: string;
  let config: RigConfig;

  const get = (path: string) => createApp(config).request(path);

  beforeAll(() => {
    dir = mkdtempSync(join(tmpdir(), 'rig-'));
    config = { adapter: 'shim', installed: '2026-10-29T14:06:00+01:00', beatEverySeconds: 60, runsDir: dir };
    writeFileSync(join(dir, `${NORMAL}.jsonl`), goodLines.join('\n') + '\n');
    writeFileSync(join(dir, `${EMPTY}.jsonl`), '');
    writeFileSync(join(dir, `${BAD}.jsonl`), [goodLines[0], '{"at":"2026-10-29T02:00:03+01:00","job":"lane/sy', ...goodLines.slice(1)].join('\n') + '\n');
  });

  afterAll(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it('200 for a night with a file: JSON rows sorted by job, HTML lists the same jobs in that order', async () => {
    const jsonRes = await get(`/api/digest/${NORMAL}`);
    expect(jsonRes.status).toBe(200);
    const body = (await jsonRes.json()) as Night;
    expect(body.night).toBe(NORMAL);
    expect(body.badLines).toBe(0);
    expect(body.rows.map((r) => r.job)).toEqual(JOBS_SORTED);
    const fixtures = body.rows.find((r) => r.job === 'fixtures/refresh');
    expect(fixtures).toMatchObject({ runs: 2, retries: 1, lastStatus: 'ok', owner: 'rook' });

    const htmlRes = await get(`/digest/${NORMAL}`);
    expect(htmlRes.status).toBe(200);
    const html = await htmlRes.text();
    const positions = body.rows.map((r) => html.indexOf(`<td>${r.job}</td>`));
    positions.forEach((p) => expect(p).toBeGreaterThan(-1));
    expect([...positions].sort((a, b) => a - b)).toEqual(positions);
  });

  it('404 for a night with no file and for a non-date, on both routes', async () => {
    for (const night of [MISSING, 'abc']) {
      const html = await get(`/digest/${night}`);
      expect(html.status).toBe(404);
      const json = await get(`/api/digest/${night}`);
      expect(json.status).toBe(404);
      expect(await json.json()).toEqual({ error: 'not found' });
    }
  });

  it('empty night: HTML says "nothing ran", JSON has no rows', async () => {
    const htmlRes = await get(`/digest/${EMPTY}`);
    expect(htmlRes.status).toBe(200);
    expect(await htmlRes.text()).toContain('nothing ran');

    const jsonRes = await get(`/api/digest/${EMPTY}`);
    expect(jsonRes.status).toBe(200);
    const body = (await jsonRes.json()) as Night;
    expect(body.rows).toEqual([]);
    expect(body.badLines).toBe(0);
  });

  it('bad line: still 200, JSON counts it, page still renders the rows', async () => {
    const jsonRes = await get(`/api/digest/${BAD}`);
    expect(jsonRes.status).toBe(200);
    const body = (await jsonRes.json()) as Night;
    expect(body.badLines).toBe(1);
    expect(body.rows.map((r) => r.job)).toEqual(JOBS_SORTED);

    const htmlRes = await get(`/digest/${BAD}`);
    expect(htmlRes.status).toBe(200);
    const html = await htmlRes.text();
    expect(html).toContain('1 line');
    expect(html).toContain('<td>fixtures/refresh</td>');
    expect(html).toContain('<td>digest/render</td>');
  });
});
