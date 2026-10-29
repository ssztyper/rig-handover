// Plan morning-digest § 1. The shape every part of § 2 builds against.

export type RunStatus = 'ok' | 'retry' | 'fail';

// One line of runs/<night>.jsonl, after parsing at the edge.
export type RunLine = {
  at: string;
  job: string;
  status: RunStatus;
  owner: string | null;
  error?: string;
};

// One row per job for the night. Times keep the log's offset (styleguide).
export type DigestRow = {
  job: string;
  owner: string | null; // null renders as '—'
  runs: number;
  retries: number;
  lastStatus: RunStatus;
  lastError: string | null;
  firstAt: string;
  lastAt: string;
};

export type Night = {
  night: string; // YYYY-MM-DD
  rows: DigestRow[]; // sorted by job
  badLines: number; // lines that didn't parse: counted, never thrown
};

// Returns null when runs/<night>.jsonl does not exist (the page answers 404).
export type ReadNight = (runsDir: string, night: string) => Night | null;
