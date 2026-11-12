// @vitest-environment node
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { brandId, type ArtifactId, type OpenQuestionId, type SessionId } from '@goodboy/types';
import { openPaneOf } from '../../../features/session/panes/openPaneOf';
import { DRAWER_KINDS } from './drawerKinds';
import type { OpenDrawer } from './state';

const SESSION_ID = brandId<SessionId>({ value: 'session-1' });

const writtenKinds = (): ReadonlyArray<string> => {
  const source = readFileSync(join(__dirname, 'state.ts'), 'utf8');
  const start = source.indexOf('export type DrawerContent =');
  const end = source.indexOf('export type', start + 1);
  const union = source.slice(start, end);
  return [...union.matchAll(/readonly kind: '([^']+)'/g)].map((match) => match[1] ?? '');
};

const paneOf = (drawer: OpenDrawer) =>
  openPaneOf({ state: { drawer, currentSessionId: SESSION_ID }, sessionId: SESSION_ID });

describe('the drawer kind table', () => {
  it('has one row for every drawer kind written in state.ts, and no other', () => {
    expect(Object.keys(DRAWER_KINDS).sort()).toEqual([...writtenKinds()].sort());
  });

  it('gives every tool a pane and no other surface one', () => {
    for (const [kind, row] of Object.entries(DRAWER_KINDS)) {
      expect(row.pane !== null, kind).toBe(row.surface === 'tool' && row.openerPane === null);
    }
  });

  it('lays only forms and wide readers in the reader tier', () => {
    const wide = Object.entries(DRAWER_KINDS)
      .filter(([, row]) => row.sizing === 'reader')
      .map(([kind]) => kind)
      .sort();
    expect(wide).toEqual(
      ['artifact-document', 'explore-file', 'file-diff', 'identifier-peek', 'new'].sort(),
    );
  });

  it('gives the browser a tier of its own', () => {
    const own = Object.entries(DRAWER_KINDS)
      .filter(([, row]) => row.sizing === 'browser')
      .map(([kind]) => kind);
    expect(own).toEqual(['browser']);
  });
});

describe('the pane a drawer lights', () => {
  it('lights the tool for a tool drawer', () => {
    expect(paneOf({ kind: 'ask', sessionId: SESSION_ID, payload: null })).toBe('ask');
    expect(paneOf({ kind: 'spawned', sessionId: SESSION_ID, payload: null })).toBe('spawned');
  });

  it('lights the opener only when the child was opened from it', () => {
    const question = brandId<OpenQuestionId>({ value: 'question-1' });
    expect(
      paneOf({ kind: 'question', sessionId: SESSION_ID, payload: { questionId: question } }),
    ).toBeNull();
    expect(
      paneOf({
        kind: 'question',
        sessionId: SESSION_ID,
        payload: { questionId: question, from: 'ask' },
      }),
    ).toBe('ask');
    expect(
      paneOf({
        kind: 'scriptRun',
        sessionId: SESSION_ID,
        payload: { scriptKey: 'test', mountId: null, from: 'scripts' },
      }),
    ).toBe('scripts');
  });

  it('lights nothing for a reader', () => {
    expect(
      paneOf({
        kind: 'artifact',
        sessionId: SESSION_ID,
        payload: { artifactId: brandId<ArtifactId>({ value: 'artifact-1' }), tab: 'details' },
      }),
    ).toBeNull();
  });

  it('lights nothing for a drawer of another session', () => {
    expect(
      openPaneOf({
        state: {
          drawer: {
            kind: 'ask',
            sessionId: brandId<SessionId>({ value: 'session-2' }),
            payload: null,
          },
          currentSessionId: SESSION_ID,
        },
        sessionId: SESSION_ID,
      }),
    ).toBeNull();
  });
});
