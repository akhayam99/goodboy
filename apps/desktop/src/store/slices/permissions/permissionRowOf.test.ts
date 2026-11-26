import { describe, expect, it } from 'vitest';
import type { AnsweredAsk } from '../../../features/permissions/askBatchOf';
import { permissionRowOf } from './permissionRowOf';

const ask = (overrides: Partial<AnsweredAsk>): AnsweredAsk => ({
  toolUseId: 'tu-1',
  toolName: 'Read',
  input: {},
  decision: 'allow',
  scope: 'once',
  reason: undefined,
  ...overrides,
});

describe('permissionRowOf', () => {
  it('carries no words for an answer with no reason', () => {
    expect(permissionRowOf({ held: [ask({})] })).toEqual({ rowOrigin: 'permission' });
  });

  it('keeps the reasons of the held denials before the last one', () => {
    const held = [
      ask({ decision: 'deny', reason: 'use the ledger-core client' }),
      ask({ decision: 'allow', reason: 'ignored on an allow' }),
      ask({ decision: 'deny', reason: '  ' }),
    ];

    expect(permissionRowOf({ held, reason: ' rename the guard ' })).toEqual({
      rowOrigin: 'permission',
      userText: 'use the ledger-core client\nrename the guard',
    });
  });

  it('keeps the held reasons when the batch ends in an allow', () => {
    const held = [ask({ decision: 'deny', reason: 'not that file' })];

    expect(permissionRowOf({ held })).toEqual({
      rowOrigin: 'permission',
      userText: 'not that file',
    });
  });
});
