import { describe, expect, it } from 'vitest';
import {
  cleanCliVersion,
  isCliVersionBelow,
  newestCliVersion,
  parseCliVersion,
} from './cliVersion';

describe('parseCliVersion', () => {
  it('reads the version out of the CLI banner', () => {
    expect(parseCliVersion({ raw: '2.1.240 (Claude Code)' })).toEqual([2, 1, 240]);
    expect(parseCliVersion({ raw: 'codex-cli 0.46.0' })).toEqual([0, 46, 0]);
  });

  it('answers quickly on a long run of dotted digits', () => {
    const started = performance.now();
    parseCliVersion({ raw: `${'1.'.repeat(50_000)}x` });
    expect(performance.now() - started).toBeLessThan(200);
  });

  it('answers null when nothing looks like a version', () => {
    expect(parseCliVersion({ raw: null })).toBeNull();
    expect(parseCliVersion({ raw: 'unknown' })).toBeNull();
  });
});

describe('isCliVersionBelow', () => {
  it('compares each part as a number', () => {
    expect(isCliVersionBelow({ installed: '2.1.259', required: '2.1.280' })).toBe(true);
    expect(isCliVersionBelow({ installed: '2.1.280', required: '2.1.280' })).toBe(false);
    expect(isCliVersionBelow({ installed: '2.10.0', required: '2.9.9' })).toBe(false);
    expect(isCliVersionBelow({ installed: '2.1', required: '2.1.1' })).toBe(true);
  });

  it('never gates an unknown version', () => {
    expect(isCliVersionBelow({ installed: null, required: '2.1.280' })).toBe(false);
    expect(isCliVersionBelow({ installed: '2.1.259', required: null })).toBe(false);
  });
});

describe('newestCliVersion', () => {
  it('keeps the highest parsable version', () => {
    expect(newestCliVersion({ versions: ['2.1.251', 'junk', '2.1.280', '2.1.3'] })).toBe('2.1.280');
    expect(newestCliVersion({ versions: [] })).toBeNull();
  });
});

describe('cleanCliVersion', () => {
  it('drops the banner around the version', () => {
    expect(cleanCliVersion({ raw: '2.1.259 (Claude Code)' })).toBe('2.1.259');
  });
});
