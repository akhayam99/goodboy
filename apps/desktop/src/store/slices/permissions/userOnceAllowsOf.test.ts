// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { userOnceAllowsOf } from './userOnceAllowsOf';

const userRow = (permissionOnceAllows?: ReadonlyArray<string>) => ({
  payload: {
    kind: 'user',
    text: 'Read the notify-relay README',
    facts: {},
    ...(permissionOnceAllows !== undefined && { permissionOnceAllows }),
  },
});

describe('userOnceAllowsOf', () => {
  it('joins the grants of every user row, once each', () => {
    expect(
      userOnceAllowsOf({
        rows: [
          userRow(['Read(//notify-relay/README.md)']),
          { payload: { kind: 'results', batchId: 'batch-1', results: [] } },
          userRow(),
          userRow(['Read(//notify-relay/README.md)', 'Read(//ledger-core/notes.md)']),
        ],
      }),
    ).toEqual(['Read(//notify-relay/README.md)', 'Read(//ledger-core/notes.md)']);
  });

  it('keeps nothing but a scoped read from a row', () => {
    expect(
      userOnceAllowsOf({ rows: [userRow(['Bash(pnpm db:migrate)', 'Read', 'Read()'])] }),
    ).toEqual([]);
  });
});
