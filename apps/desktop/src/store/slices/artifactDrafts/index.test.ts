// @vitest-environment happy-dom

import { beforeEach, describe, expect, it } from 'vitest';
import { createStore } from 'zustand';
import type { IsoDateTime, SessionId } from '@goodboy/types';
import { createArtifactDraftsSlice } from './index';
import type {
  ArtifactDraftsSlice,
  ArtifactReportDraft,
  ArtifactWireframeDraft,
  GetFn,
  SetFn,
} from './types';

const SESSION_ID = 'session-harborline' as SessionId;
const OTHER_SESSION_ID = 'session-northwind' as SessionId;
const NOW = '2026-09-16T10:00:00.000Z' as IsoDateTime;

const STORAGE_KEY = `goodboy:artifact-drafts:${SESSION_ID}`;

const makeStore = () =>
  createStore<ArtifactDraftsSlice>((set, get) =>
    createArtifactDraftsSlice(set as SetFn, get as GetFn),
  );

const BASE_REPORT: ArtifactReportDraft = {
  kind: 'report',
  reportType: 'session-summary',
  brief: '',
  basedOn: { kind: 'session' },
  routing: null,
  updatedAt: NOW,
};

const BASE_WIREFRAME: ArtifactWireframeDraft = {
  kind: 'wireframe',
  fidelity: 'low',
  brief: '',
  basedOn: { kind: 'session' },
  routing: null,
  updatedAt: NOW,
};

const reportDraft = (overrides: Partial<ArtifactReportDraft> = {}): ArtifactReportDraft => ({
  ...BASE_REPORT,
  ...overrides,
});

describe('artifactDrafts slice', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('stores one draft per session and kind', () => {
    const store = makeStore();
    store.getState().setArtifactDraft({
      sessionId: SESSION_ID,
      draft: reportDraft({ brief: 'summarise the ledger-core work' }),
    });
    store.getState().setArtifactDraft({
      sessionId: SESSION_ID,
      draft: BASE_WIREFRAME,
    });
    store.getState().setArtifactDraft({
      sessionId: OTHER_SESSION_ID,
      draft: reportDraft({ brief: 'notify-relay retries' }),
    });
    expect(store.getState().artifactDrafts[SESSION_ID]?.report?.brief).toBe(
      'summarise the ledger-core work',
    );
    expect(store.getState().artifactDrafts[SESSION_ID]?.wireframe?.kind).toBe('wireframe');
    expect(store.getState().artifactDrafts[OTHER_SESSION_ID]?.report?.brief).toBe(
      'notify-relay retries',
    );
  });

  it('restores a draft from storage once and ignores a malformed envelope', () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ v: 1, report: reportDraft({ brief: 'restored brief' }) }),
    );
    const store = makeStore();
    store.getState().hydrateArtifactDrafts({ sessionId: SESSION_ID });
    expect(store.getState().artifactDrafts[SESSION_ID]?.report?.brief).toBe('restored brief');

    localStorage.setItem(STORAGE_KEY, '{ not json');
    store.getState().hydrateArtifactDrafts({ sessionId: SESSION_ID });
    expect(store.getState().artifactDrafts[SESSION_ID]?.report?.brief).toBe('restored brief');
  });

  it('drops a stored draft whose choice is no longer valid', () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        v: 1,
        report: { ...reportDraft(), reportType: 'retired-type' },
        wireframe: { ...BASE_WIREFRAME, fidelity: 'ultra' },
      }),
    );
    const store = makeStore();
    store.getState().hydrateArtifactDrafts({ sessionId: SESSION_ID });
    expect(store.getState().artifactDrafts[SESSION_ID]).toEqual({});
  });

  it('removes the storage row when the last draft is cleared', () => {
    const store = makeStore();
    store.getState().setArtifactDraft({
      sessionId: SESSION_ID,
      draft: reportDraft({ brief: 'one' }),
    });
    store.getState().setArtifactDraft({
      sessionId: SESSION_ID,
      draft: { ...BASE_WIREFRAME, brief: 'two' },
    });
    store.getState().clearArtifactDraft({ sessionId: SESSION_ID, kind: 'report' });
    expect(localStorage.getItem(STORAGE_KEY)).not.toBeNull();
    store.getState().clearArtifactDraft({ sessionId: SESSION_ID, kind: 'wireframe' });
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
    expect(store.getState().artifactDrafts[SESSION_ID]).toEqual({});
  });

  it('keeps hydrate a no-op once the session already has drafts in state', () => {
    const store = makeStore();
    store.getState().setArtifactDraft({
      sessionId: SESSION_ID,
      draft: reportDraft({ brief: 'in memory' }),
    });
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ v: 1, report: reportDraft({ brief: 'on disk' }) }),
    );
    store.getState().hydrateArtifactDrafts({ sessionId: SESSION_ID });
    expect(store.getState().artifactDrafts[SESSION_ID]?.report?.brief).toBe('in memory');
  });
});
