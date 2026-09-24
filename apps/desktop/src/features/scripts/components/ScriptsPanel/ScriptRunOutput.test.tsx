// @vitest-environment happy-dom

import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { ScriptRunOutput } from './ScriptRunOutput';

afterEach(cleanup);

describe('ScriptRunOutput', () => {
  it.each([
    ['ok', 0, 'Passed'],
    ['error', 1, 'Failed'],
  ] as const)('names a %s run %s', (status, exitCode, label) => {
    render(
      <ScriptRunOutput
        run={{
          status,
          runId: 'run-1',
          startedAt: 1,
          result: { stdout: 'done', stderr: '', exitCode },
        }}
        completedAt={undefined}
      />,
    );

    expect(screen.getByText(label)).toBeDefined();
    expect(screen.getByText(`Exit ${exitCode}`)).toBeDefined();
  });

  it('streams the output while the script runs', () => {
    render(
      <ScriptRunOutput
        run={{
          status: 'pending',
          runId: 'run-1',
          startedAt: 1,
          result: null,
          output: 'checking 12 files',
        }}
        completedAt={undefined}
      />,
    );

    expect(screen.getByText('checking 12 files')).toBeDefined();
    expect(screen.queryByText('Waiting for output')).toBeNull();
  });
});
