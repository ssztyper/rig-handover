import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { readNight } from './read.js';

const runsDir = 'runs';

describe('readNight', () => {
  const night = readNight(runsDir, '2026-10-28');

  it('reads 5 jobs and 1 bad line, sorted by job', () => {
    expect(night).not.toBeNull();
    expect(night!.night).toBe('2026-10-28');
    expect(night!.badLines).toBe(1);
    expect(night!.rows.map((r) => r.job)).toEqual([
      'digest/render',
      'fixtures/refresh',
      'lane/sync',
      'notes/backup',
      'rig/rotate-logs',
    ]);
  });

  it('counts retries and keeps the last status', () => {
    const row = night!.rows.find((r) => r.job === 'fixtures/refresh')!;
    expect(row).toMatchObject({ runs: 4, retries: 3, lastStatus: 'ok', lastError: null });
    expect(row.firstAt).toBe('2026-10-29T01:30:00+01:00');
    expect(row.lastAt).toBe('2026-10-29T01:37:00+01:00');
  });

  it('keeps the last error of a failed job', () => {
    const row = night!.rows.find((r) => r.job === 'notes/backup')!;
    expect(row).toMatchObject({ lastStatus: 'fail', lastError: 'quota exceeded', owner: 'lane-07' });
  });

  it('keeps a row whose owner is null', () => {
    const row = night!.rows.find((r) => r.job === 'digest/render')!;
    expect(row.owner).toBeNull();
  });

  it('returns null for a night with no file', () => {
    expect(readNight(runsDir, '1999-01-01')).toBeNull();
  });

  describe('temp runs dir', () => {
    const dir = mkdtempSync(join(tmpdir(), 'rig-read-'));
    afterAll(() => rmSync(dir, { recursive: true, force: true }));

    it('gives no rows for an empty file', () => {
      writeFileSync(join(dir, '2026-01-01.jsonl'), '');
      expect(readNight(dir, '2026-01-01')).toEqual({ night: '2026-01-01', rows: [], badLines: 0 });
    });

    it('counts invalid lines and ignores blank ones', () => {
      writeFileSync(
        join(dir, '2026-01-02.jsonl'),
        [
          '{"at":"2026-01-02T01:00:00+01:00","job":"a","status":"ok","owner":"x"}',
          '',
          '{"at":"2026-01-02T01:00:00+01:00","job":"a","status":"done","owner":"x"}',
          '{"job":"a","status":"ok","owner":"x"}',
          '[]',
          'not json',
        ].join('\n'),
      );
      const n = readNight(dir, '2026-01-02')!;
      expect(n.rows).toHaveLength(1);
      expect(n.badLines).toBe(4);
    });
  });
});
