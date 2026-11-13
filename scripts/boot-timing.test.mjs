import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  formatReport,
  launchOf,
  parseLogLine,
  parseMarks,
  percentile,
  summarize,
} from './lib/bootTiming.mjs';

const launchLines = ({ pid, start, readyMs, marks }) => [
  `${start} ${start}-${pid} process-start start`,
  `${start + 40} ${start}-${pid} window-created ok`,
  `${start + 90} ${start}-${pid} webview-attached ok`,
  `${start + 100} ${start}-${pid} pending start`,
  `${start + 100 + readyMs} ${start}-${pid} ready ms=${readyMs},ok`,
  ...(marks === undefined ? [] : [`${start + 1500} ${start}-${pid} marks ${marks}`]),
  `${start} 1-999 process-start start`,
];

describe('boot-timing', () => {
  it('reads a breadcrumb line', () => {
    assert.deepEqual(parseLogLine({ line: '1700 1699-42 ready ms=820,ok' }), {
      at: 1700,
      launchId: '1699-42',
      phase: 'ready',
      detail: 'ms=820,ok',
    });
    assert.equal(parseLogLine({ line: '' }), null);
    assert.equal(parseLogLine({ line: 'not a line' }), null);
  });

  it('reads the named marks of a marks line', () => {
    assert.deepEqual(parseMarks({ detail: 'script=12,ready=840,board=910' }), {
      script: 12,
      ready: 840,
      board: 910,
    });
  });

  it('builds one launch from the lines of one process', () => {
    const lines = launchLines({
      pid: 42,
      start: 1000,
      readyMs: 800,
      marks: 'script=10,ready=860,board=930,splash=1290',
    });

    const launch = launchOf({ lines, pid: 42 });

    assert.equal(launch.hasMarks, true);
    assert.equal(launch.metrics['process-to-ready'], 900);
    assert.equal(launch.metrics['boot-ms'], 800);
    assert.equal(launch.metrics['mark-splash'], 1290);
  });

  it('keeps a build without marks and ignores the lines of other processes', () => {
    const lines = launchLines({ pid: 42, start: 1000, readyMs: 800 });

    const launch = launchOf({ lines, pid: 42 });

    assert.equal(launch.hasMarks, false);
    assert.equal(launch.metrics['process-to-ready'], 900);
    assert.equal(launchOf({ lines, pid: 7 }), null);
  });

  it('waits for a ready line', () => {
    const lines = ['1000 1000-42 process-start start', '1100 1000-42 pending start'];

    assert.equal(launchOf({ lines, pid: 42 }), null);
  });

  it('takes the median and the 95th percentile by nearest rank', () => {
    const values = [5, 1, 4, 2, 3, 10, 9, 8, 7, 6];

    assert.equal(percentile({ values, p: 50 }), 5);
    assert.equal(percentile({ values, p: 95 }), 10);
    assert.equal(percentile({ values: [], p: 50 }), null);
    assert.equal(percentile({ values: [7], p: 95 }), 7);
  });

  it('summarizes every metric across launches and prints a table', () => {
    const launches = [800, 900, 1000].map((readyMs, index) =>
      launchOf({
        lines: launchLines({ pid: index + 1, start: 1000, readyMs, marks: 'ready=870' }),
        pid: index + 1,
      }),
    );

    const summary = summarize({ launches });
    const ready = summary.find((row) => row.name === 'process-to-ready');

    assert.equal(ready.runs, 3);
    assert.equal(ready.median, 1000);
    assert.equal(ready.p95, 1100);
    const report = formatReport({ label: '0.34.0', summary });
    assert.match(report, /^0\.34\.0\nmetric/);
    assert.match(report, /process-to-ready/);
  });
});
