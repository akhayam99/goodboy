// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { parseFrameMessage } from './frameMessage';

describe('parseFrameMessage', () => {
  it('reads a navigation to a page inside the stage', () => {
    expect(
      parseFrameMessage({
        data: {
          channel: 'gbframe',
          type: 'navigated',
          path: 'screens/a--empty.html',
          height: 812.4,
        },
      }),
    ).toEqual({ type: 'navigated', path: 'screens/a--empty.html', height: 812 });
  });

  it('drops anything outside the closed set of messages', () => {
    const rejected = [
      null,
      'navigated',
      { type: 'navigated', path: 'index.html' },
      { channel: 'goodboy', type: 'navigated', path: 'index.html' },
      { channel: 'gbframe', type: 'navigated', path: '../index.html' },
      { channel: 'gbframe', type: 'navigated', path: '/etc/passwd' },
      { channel: 'gbframe', type: 'navigated', path: 'a/b/c/d.html' },
      { channel: 'gbframe', type: 'picked', nodeId: '', label: 'x' },
      { channel: 'gbframe', type: 'picked', nodeId: 'x'.repeat(600), label: 'x' },
      { channel: 'gbframe', type: 'invoke', cmd: 'frame_stage' },
    ];
    for (const data of rejected) {
      expect(parseFrameMessage({ data })).toBeNull();
    }
  });

  it('reads a pick with the node id and its label', () => {
    expect(
      parseFrameMessage({
        data: { channel: 'gbframe', type: 'picked', nodeId: 'exception-list', label: 'Exceptions' },
      }),
    ).toEqual({ type: 'picked', nodeId: 'exception-list', label: 'Exceptions' });
  });
});
