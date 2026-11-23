import { describe, expect, it } from 'vitest';
import { brandId, type AgentId, type MountId, type SessionId } from '@goodboy/types';
import type { DrawerGrid, OpenDrawer } from './state';
import {
  parseStoredDeskDetail,
  parseStoredDockGrid,
  storedDockGridOf,
} from './dockGridMemory/storedDockGrid';

const SESSION = brandId<SessionId>({ value: 'session-harborline' });

const GRID: DrawerGrid = {
  columns: [[{ kind: 'browser', sessionId: SESSION, payload: null }]],
  used: ['browser'],
  focus: { at: 'detail' },
  widths: { browser: 640 },
  splits: {},
};

const AGENT: OpenDrawer = {
  kind: 'transcript',
  sessionId: SESSION,
  payload: { agentId: brandId<AgentId>({ value: 'agent-implementer' }) },
};

const PR: OpenDrawer = {
  kind: 'pull-request',
  sessionId: SESSION,
  payload: { mountId: brandId<MountId>({ value: 'mount-payments-api' }), tab: 'checks' },
};

const raw = ({ value }: { readonly value: unknown }): string => JSON.stringify(value);

describe('the agent and the pull request in the stored desk layout', () => {
  it('reads back the agent and the pull request it wrote', () => {
    const stored = storedDockGridOf({ grid: GRID, face: 'desk', detail: [AGENT, PR] });

    expect(parseStoredDeskDetail({ raw: stored, sessionId: SESSION })).toEqual([AGENT, PR]);
  });

  it('is an optional field: a build that never knew it reads the same grid', () => {
    const withDetail = storedDockGridOf({ grid: GRID, face: 'desk', detail: [AGENT, PR] });
    const without = storedDockGridOf({ grid: GRID, face: 'desk' });

    expect(parseStoredDockGrid({ raw: withDetail })).toEqual(parseStoredDockGrid({ raw: without }));
    expect(JSON.parse(withDetail)).toMatchObject({ version: 1, columns: GRID.columns });
  });

  it('reads a row saved by an older build as no detail', () => {
    const older = raw({ value: { version: 1, columns: GRID.columns, used: ['browser'] } });

    expect(parseStoredDeskDetail({ raw: older, sessionId: SESSION })).toEqual([]);
    expect(parseStoredDockGrid({ raw: older })?.columns).toEqual(GRID.columns);
  });

  it('writes nothing for an empty detail, nor for a reader it does not keep', () => {
    const scripts: OpenDrawer = { kind: 'scripts', sessionId: SESSION, payload: null };

    expect(JSON.parse(storedDockGridOf({ grid: GRID, detail: [] }))).not.toHaveProperty('detail');
    expect(JSON.parse(storedDockGridOf({ grid: GRID, detail: [scripts] }))).not.toHaveProperty(
      'detail',
    );
  });

  it('drops an entry it cannot read, a second of a kind and anything past two', () => {
    const stored = raw({
      value: {
        version: 1,
        columns: [],
        detail: [
          { kind: 'transcript', agentId: '' },
          { kind: 'pull-request', mountId: 'mount-payments-api', tab: 'files' },
          { kind: 'transcript', agentId: 'agent-implementer' },
          { kind: 'transcript', agentId: 'agent-tester' },
        ],
      },
    });

    expect(parseStoredDeskDetail({ raw: stored, sessionId: SESSION })).toEqual([]);
    expect(
      parseStoredDeskDetail({
        raw: raw({
          value: {
            version: 1,
            columns: [],
            detail: [
              { kind: 'transcript', agentId: 'agent-implementer' },
              { kind: 'transcript', agentId: 'agent-tester' },
            ],
          },
        }),
        sessionId: SESSION,
      }),
    ).toEqual([AGENT]);
  });

  it('ignores a row from another version or that is not JSON', () => {
    expect(parseStoredDeskDetail({ raw: '{', sessionId: SESSION })).toEqual([]);
    expect(
      parseStoredDeskDetail({
        raw: raw({ value: { version: 2, detail: [{ kind: 'transcript', agentId: 'a' }] } }),
        sessionId: SESSION,
      }),
    ).toEqual([]);
  });
});
