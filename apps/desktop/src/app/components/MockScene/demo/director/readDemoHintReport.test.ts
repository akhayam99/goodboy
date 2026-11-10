import { describe, expect, it } from 'vitest';
import { DEMO_PROTOCOL } from './demoProtocol';
import { readDemoHintReport } from './readDemoHintReport';

type AnchorParams = {
  readonly isRecovering?: unknown;
};

const anchorOf = ({ isRecovering }: AnchorParams) => ({
  channel: DEMO_PROTOCOL.channel,
  version: DEMO_PROTOCOL.version,
  generation: 2,
  type: 'anchor',
  hintId: 'plan-comment',
  rect: { x: 10, y: 20, width: 40, height: 24 },
  isOffscreen: false,
  ...(isRecovering === undefined ? {} : { isRecovering }),
});

describe('reading a hint report from the demo frame', () => {
  it('keeps the way back flag when the frame sends it', () => {
    expect(readDemoHintReport({ data: anchorOf({ isRecovering: true }) })).toMatchObject({
      hintId: 'plan-comment',
      isRecovering: true,
    });
  });

  it('reads a report without the flag as before', () => {
    const report = readDemoHintReport({ data: anchorOf({}) });
    expect(report).toMatchObject({ hintId: 'plan-comment' });
    expect(report).not.toHaveProperty('isRecovering');
  });

  it('drops a report whose flag is not a boolean', () => {
    expect(readDemoHintReport({ data: anchorOf({ isRecovering: 'yes' }) })).toBeNull();
  });
});
