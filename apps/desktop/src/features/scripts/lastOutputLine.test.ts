// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { lastOutputLine } from './lastOutputLine';

describe('lastOutputLine', () => {
  it.each([
    ['empty', '', null],
    ['whitespace only', '  \n \t\n\n', null],
    ['one line', 'ready', 'ready'],
    ['trailing newlines', 'ready\nlistening on 5005\n\n', 'listening on 5005'],
    ['blank lines after the text', 'first\nsecond\n   \n', 'second'],
    [
      'a progress line redrawn with carriage returns',
      'building 10%\rbuilding 80%\r',
      'building 80%',
    ],
    ['windows line ends', 'one\r\ntwo\r\n', 'two'],
  ])('reads %s', (_label, output, expected) => {
    expect(lastOutputLine({ output })).toBe(expected);
  });

  it('is null without output', () => {
    expect(lastOutputLine({ output: undefined })).toBeNull();
  });

  it('handles a 100k character tail without slowing down', () => {
    const output = `${'x'.repeat(100_000)}\nlast`;

    expect(lastOutputLine({ output })).toBe('last');
  });
});
