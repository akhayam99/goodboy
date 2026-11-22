import { describe, expect, it } from 'vitest';
import { brandId, type AgentId } from '@goodboy/types';
import { DESK_OFF_REASON, landingOf, type DeskToolKind, type LandingParams } from './landingOf';

const implementer = brandId<AgentId>({ value: 'agent-implementer' });

const EVERY_TOOL: ReadonlySet<DeskToolKind> = new Set<DeskToolKind>(['agent', 'pr', 'terminal']);

const base: LandingParams = {
  door: 'desk',
  move: null,
  lastFace: null,
  hasKept: false,
  next: [],
  nowAgentId: null,
  firstMountId: 'mount-ledger-core',
  hasWorkspaceFolder: true,
  canOpen: EVERY_TOOL,
};

const failedCheck = { kind: 'fix-checks', mountId: 'mount-payments-api', agentId: implementer };

describe('landingOf, the one entry rule', () => {
  it('opens the tools the session had first', () => {
    expect(landingOf({ ...base, hasKept: true, next: [failedCheck] })).toEqual({
      face: 'desk',
      isKept: true,
    });
  });

  it('then the tools of the first move of Next that has some', () => {
    const answer = { kind: 'answer-questions', mountId: null, agentId: null };

    expect(landingOf({ ...base, next: [answer, failedCheck] })).toEqual({
      face: 'desk',
      isKept: false,
      tools: [
        { kind: 'agent', agentId: implementer },
        { kind: 'pr', mountId: 'mount-payments-api', tab: 'checks' },
        { kind: 'terminal', mountId: 'mount-payments-api' },
      ],
    });
  });

  it('then the agent of Now, then the terminal of the first project', () => {
    expect(landingOf({ ...base, nowAgentId: implementer })).toEqual({
      face: 'desk',
      isKept: false,
      tools: [{ kind: 'agent', agentId: implementer }],
    });
    expect(landingOf(base)).toEqual({
      face: 'desk',
      isKept: false,
      tools: [{ kind: 'terminal', mountId: 'mount-ledger-core' }],
    });
  });

  it('then the terminal of the workspace folder, else the Desk stays off with the reason', () => {
    expect(landingOf({ ...base, firstMountId: null })).toEqual({
      face: 'desk',
      isKept: false,
      tools: [{ kind: 'terminal', mountId: null }],
    });
    expect(landingOf({ ...base, firstMountId: null, hasWorkspaceFolder: false })).toEqual({
      face: 'overview',
      reason: DESK_OFF_REASON,
    });
  });

  it('only picks tools this build can draw', () => {
    const terminalOnly: ReadonlySet<DeskToolKind> = new Set<DeskToolKind>(['terminal']);

    expect(
      landingOf({ ...base, canOpen: terminalOnly, nowAgentId: implementer, next: [failedCheck] }),
    ).toEqual({
      face: 'desk',
      isKept: false,
      tools: [{ kind: 'terminal', mountId: 'mount-payments-api' }],
    });
  });

  it('a door that names a question, a permission or a plan lands on the overview', () => {
    for (const kind of ['answer-questions', 'approve-tool', 'plan-ready']) {
      expect(
        landingOf({ ...base, door: 'move', move: { kind, mountId: null }, lastFace: 'desk' }),
      ).toEqual({ face: 'overview', reason: null });
    }
  });

  it('a door that names a check, a conflict or a review comment lands on the Desk with its tools', () => {
    expect(landingOf({ ...base, door: 'move', move: failedCheck, hasKept: true })).toEqual({
      face: 'desk',
      isKept: false,
      tools: [
        { kind: 'agent', agentId: implementer },
        { kind: 'pr', mountId: 'mount-payments-api', tab: 'checks' },
        { kind: 'terminal', mountId: 'mount-payments-api' },
      ],
    });
    expect(
      landingOf({
        ...base,
        door: 'move',
        move: { kind: 'resolve-threads', mountId: 'mount-notify-relay' },
      }),
    ).toEqual({
      face: 'desk',
      isKept: false,
      tools: [{ kind: 'pr', mountId: 'mount-notify-relay', tab: 'comments' }],
    });
  });

  it('a door that names no move lands on the last face, the overview the first time', () => {
    expect(landingOf({ ...base, door: 'place' })).toEqual({ face: 'overview', reason: null });
    expect(landingOf({ ...base, door: 'place', lastFace: 'overview' })).toEqual({
      face: 'overview',
      reason: null,
    });
    expect(landingOf({ ...base, door: 'place', lastFace: 'desk', hasKept: true })).toEqual({
      face: 'desk',
      isKept: true,
    });
  });

  it('never dispatches on a key outside the table', () => {
    expect(
      landingOf({ ...base, door: 'move', move: { kind: 'constructor', mountId: 'mount-x' } }),
    ).toEqual({ face: 'overview', reason: null });
  });
});
