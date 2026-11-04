import { describe, expect, it } from 'vitest';
import { extractStuckMarker } from './extractStuckMarker';

describe('extractStuckMarker', () => {
  it('reads the id and the reason of a step-stuck marker', () => {
    const text = 'no access\n<<step-stuck id="agent-1" reason="the ledger-core token is missing">>';
    expect(extractStuckMarker({ text, kind: 'step' })).toEqual({
      id: 'agent-1',
      reason: 'the ledger-core token is missing',
    });
  });

  it('reads a marker with no reason as an empty reason', () => {
    expect(extractStuckMarker({ text: '<<step-stuck id="agent-1">>', kind: 'step' })).toEqual({
      id: 'agent-1',
      reason: '',
    });
  });

  it('keeps the last marker and ignores one without an id', () => {
    const text =
      '<<step-stuck reason="x">> <<step-stuck id="a" reason="one">> <<step-stuck id="b" reason="two">>';
    expect(extractStuckMarker({ text, kind: 'step' })).toEqual({ id: 'b', reason: 'two' });
  });

  it('returns null when there is no stuck marker', () => {
    expect(
      extractStuckMarker({ text: 'done <<step-done id="agent-1">>', kind: 'step' }),
    ).toBeNull();
    expect(extractStuckMarker({ text: 'nothing here', kind: 'cluster' })).toBeNull();
  });

  it('reads a cluster-stuck marker and not a step-stuck one', () => {
    const text = '<<cluster-stuck id="child-1" reason="payments-api is down">>';
    expect(extractStuckMarker({ text, kind: 'cluster' })).toEqual({
      id: 'child-1',
      reason: 'payments-api is down',
    });
    expect(extractStuckMarker({ text, kind: 'step' })).toBeNull();
  });

  it('reads a marker printed with escaped brackets or curly quotes', () => {
    const escaped = '\\<\\<step-stuck id="agent-1" reason="no repo"\\>\\>';
    const curly = '<<step-stuck id=“agent-2” reason=“no repo”>>';
    expect(extractStuckMarker({ text: escaped, kind: 'step' })?.id).toBe('agent-1');
    expect(extractStuckMarker({ text: curly, kind: 'step' })?.id).toBe('agent-2');
  });

  it('never reads a bare marker an agent talks about', () => {
    expect(extractStuckMarker({ text: 'I will emit <<step-stuck>>', kind: 'step' })).toBeNull();
  });
});
