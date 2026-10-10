import { describe, expect, it } from 'vitest';
import { formatStoppedProcesses } from './formatStoppedProcesses';

const stoppedProcess = (pid: number, name: string) => ({ pid, name, port: null });

describe('formatStoppedProcesses', () => {
  it('names the first process and counts the rest', () => {
    expect(
      formatStoppedProcesses({
        stopped: [stoppedProcess(10, 'next-server'), stoppedProcess(11, 'sh')],
      }),
    ).toBe('Stopped 2 processes this turn left running: next-server, 1 more.');
  });

  it('uses the singular for one process', () => {
    expect(formatStoppedProcesses({ stopped: [stoppedProcess(10, 'vite')] })).toBe(
      'Stopped 1 process this turn left running: vite.',
    );
  });

  it('counts every extra process', () => {
    const stopped = [
      stoppedProcess(1, 'node'),
      stoppedProcess(2, 'node'),
      stoppedProcess(3, 'esbuild'),
      stoppedProcess(4, 'sh'),
    ];
    expect(formatStoppedProcesses({ stopped })).toBe(
      'Stopped 4 processes this turn left running: node, 3 more.',
    );
  });

  it('says nothing when nothing was stopped', () => {
    expect(formatStoppedProcesses({ stopped: [] })).toBeNull();
  });
});
