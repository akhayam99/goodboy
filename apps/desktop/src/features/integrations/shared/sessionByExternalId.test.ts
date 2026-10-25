// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { brandId, type Session, type SessionId } from '@goodboy/types';
import { aSession } from '@goodboy/types/testing';
import { sessionByExternalId } from './sessionByExternalId';

type Ticket = {
  readonly id: string;
  readonly branch: string;
};

const SESSION_ONE = aSession({ id: brandId<SessionId>({ value: 'session-1' }) });
const SESSION_TWO = aSession({ id: brandId<SessionId>({ value: 'session-2' }) });

const resolve = ({
  issues,
  sessions,
  linked = new Map(),
  branchOf = {},
}: {
  readonly issues: ReadonlyArray<Ticket>;
  readonly sessions: ReadonlyArray<Session>;
  readonly linked?: ReadonlyMap<string, SessionId>;
  readonly branchOf?: Readonly<Record<string, string>>;
}) =>
  sessionByExternalId({
    issues,
    sessions,
    linkedSessions: linked,
    provider: 'jira',
    externalIdOf: ({ issue }) => issue.id,
    isSessionOfIssue: ({ issue, session }) => branchOf[session.id] === issue.branch,
  });

describe('sessionByExternalId', () => {
  it('takes the session linked by external id first', () => {
    const byIssue = resolve({
      issues: [{ id: '10', branch: 'ak/ledger-fix' }],
      sessions: [SESSION_ONE, SESSION_TWO],
      linked: new Map([['jira:10', SESSION_TWO.id]]),
      branchOf: { [SESSION_ONE.id]: 'ak/ledger-fix' },
    });

    expect(byIssue.get('10')).toBe(SESSION_TWO.id);
  });

  it('falls back to the first session the provider rule accepts', () => {
    const byIssue = resolve({
      issues: [{ id: '10', branch: 'ak/ledger-fix' }],
      sessions: [SESSION_ONE, SESSION_TWO],
      branchOf: { [SESSION_ONE.id]: 'ak/other', [SESSION_TWO.id]: 'ak/ledger-fix' },
    });

    expect(byIssue.get('10')).toBe(SESSION_TWO.id);
  });

  it('leaves an issue nobody works on out of the map', () => {
    const byIssue = resolve({
      issues: [{ id: '10', branch: 'ak/ledger-fix' }],
      sessions: [SESSION_ONE],
      branchOf: { [SESSION_ONE.id]: 'ak/other' },
    });

    expect(byIssue.has('10')).toBe(false);
  });

  it('ignores a link written for another provider', () => {
    const byIssue = resolve({
      issues: [{ id: '10', branch: 'ak/ledger-fix' }],
      sessions: [SESSION_ONE],
      linked: new Map([['linear:10', SESSION_ONE.id]]),
    });

    expect(byIssue.has('10')).toBe(false);
  });
});
