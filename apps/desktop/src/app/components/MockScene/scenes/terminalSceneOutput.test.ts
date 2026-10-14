import { describe, expect, it } from 'vitest';
import {
  DEV_SERVER_PORT,
  devServerLines,
  shellPromptLines,
  terminalIdOf,
  terminalSnapshotAnswer,
} from './terminalSceneOutput';

type DecodeParams = {
  readonly data: string;
};

const decode = ({ data }: DecodeParams): string => atob(data);

describe('the terminal scene output', () => {
  it('ends a shell scene on a prompt line so the cursor follows text, never the corner', () => {
    const lines = decode(
      terminalSnapshotAnswer({ lines: shellPromptLines({ folder: 'harborline' }) }),
    ).split('\r\n');

    expect(lines).toHaveLength(2);
    expect(lines[0]).toContain('harborline');
    expect(lines[1]).toContain('%');
  });

  it('prints the dev server port the rail and the tab chips show', () => {
    const text = decode(terminalSnapshotAnswer({ lines: devServerLines }));

    expect(text).toContain(`http://localhost:${DEV_SERVER_PORT}/`);
  });

  it('answers a snapshot with the offset and no exit code', () => {
    expect(terminalSnapshotAnswer({ lines: ['a'] })).toMatchObject({ offset: 0, exitCode: null });
  });

  it('reads the terminal id of a snapshot request and nothing else', () => {
    expect(terminalIdOf({ payload: { sessionId: 'ws::t1' } })).toBe('ws::t1');
    expect(terminalIdOf({ payload: null })).toBe('');
    expect(terminalIdOf({ payload: { sessionId: 7 } })).toBe('');
  });
});
