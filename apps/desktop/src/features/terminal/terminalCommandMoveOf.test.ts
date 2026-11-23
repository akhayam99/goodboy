import { describe, expect, it } from 'vitest';
import type { MountId, SessionId } from '@goodboy/types';
import { brandedId } from '../history/testing/brandedId';
import type { MoveFacts, NextMove } from '../suggestions/types';
import { terminalCommandMoveOf } from './terminalCommandMoveOf';

const SESSION_ID = brandedId<SessionId>({ value: 'session-harborline' });
const PAYMENTS = brandedId<MountId>({ value: 'mount-payments' });
const RELAY = brandedId<MountId>({ value: 'mount-relay' });
const CWD = '/Users/dev/harborline/payments-api';

const FACTS: MoveFacts = {
  reason: 'A migration changed in the last turn',
  evidence: [],
  place: { tool: 'terminal', mountId: null, agentId: null },
  completesWhen: { kind: 'move-gone' },
  group: 'upkeep',
  read: null,
};

type ScriptParams = {
  readonly mountId: MountId;
  readonly scriptName: string;
  readonly mode: 'run' | 'type';
};

const scriptMove = ({ mountId, scriptName, mode }: ScriptParams): NextMove => ({
  ...FACTS,
  id: `next-script:${mountId}:${scriptName}`,
  kind: 'next-script',
  priority: 46,
  band: 2,
  title: `Run ${scriptName}`,
  sessionId: SESSION_ID,
  targetKey: null,
  fingerprint: `${mountId}:${scriptName}`,
  payload: {
    mountId,
    scriptId: `pnpm:${scriptName}`,
    scriptName,
    turnAtMs: 1,
    rule: 'migrations',
    command: { text: `pnpm ${scriptName}`, cwd: CWD, mode, scriptId: `pnpm:${scriptName}` },
  },
});

const testMove: NextMove = {
  ...FACTS,
  id: 'run-failing-test:relay',
  kind: 'run-failing-test',
  priority: 40,
  band: 1,
  title: 'Run the failing test',
  sessionId: SESSION_ID,
  targetKey: null,
  fingerprint: 'relay:test',
  payload: {
    mountId: RELAY,
    prNumber: 96,
    checkName: 'unit',
    detailsUrl: 'https://github.com/harborline/notify-relay/actions/runs/1',
    testName: 'retries the webhook',
    command: { text: "pnpm test 'retries the webhook'", cwd: CWD, mode: 'run', scriptId: null },
  },
};

describe('the command a terminal suggests', () => {
  it('shows the first command move of the track on screen', () => {
    const install = scriptMove({ mountId: PAYMENTS, scriptName: 'install', mode: 'run' });

    const move = terminalCommandMoveOf({
      moves: [testMove, install],
      mountId: PAYMENTS,
      hiddenIds: new Set(),
    });

    expect(move?.id).toBe(install.id);
    expect(move?.payload.command.mode).toBe('run');
  });

  it('skips a move put off with Not now', () => {
    const install = scriptMove({ mountId: PAYMENTS, scriptName: 'install', mode: 'run' });

    expect(
      terminalCommandMoveOf({
        moves: [install],
        mountId: PAYMENTS,
        hiddenIds: new Set([install.id]),
      }),
    ).toBeNull();
  });

  it('types a destructive script even when the move asked to run it', () => {
    const migrate = scriptMove({ mountId: PAYMENTS, scriptName: 'db:migrate', mode: 'run' });

    const move = terminalCommandMoveOf({
      moves: [migrate],
      mountId: PAYMENTS,
      hiddenIds: new Set(),
    });

    expect(move?.payload.command.mode).toBe('type');
  });

  it('types a test filter read from a check log even when the move asked to run it', () => {
    const move = terminalCommandMoveOf({ moves: [testMove], mountId: RELAY, hiddenIds: new Set() });

    expect(move?.payload.command.mode).toBe('type');
  });
});
