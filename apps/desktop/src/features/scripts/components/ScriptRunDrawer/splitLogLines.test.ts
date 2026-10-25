// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { splitLogLines } from './splitLogLines';

describe('splitLogLines', () => {
  it('shows one line for a progress bar that redraws with carriage returns', () => {
    expect(splitLogLines({ stdout: '10%\r55%\r100%\ndone\n', stderr: '' })).toEqual([
      { stream: 'stdout', text: '100%' },
      { stream: 'stdout', text: 'done' },
    ]);
  });

  it('drops the open frame marker of a running line', () => {
    expect(splitLogLines({ stdout: 'building 40%\r', stderr: '' })).toEqual([
      { stream: 'stdout', text: 'building 40%' },
    ]);
  });

  it('puts stderr lines after stdout lines', () => {
    expect(splitLogLines({ stdout: 'a\r\n', stderr: 'oops\n' })).toEqual([
      { stream: 'stdout', text: 'a' },
      { stream: 'stderr', text: 'oops' },
    ]);
  });
});
