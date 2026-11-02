import { brandId, type IsoDateTime, type Session, type SessionId } from '@goodboy/types';
import { useAppStore } from '../../../../../store';
import { sessionById } from '../../../../../store/slices/sessions/sessionIndex';
import { WORKSPACE_ID, seedBoardScene } from '../BoardScene';

export const LANE_WINDOW_DONE = 120;
export const LANE_WINDOW_ARCHIVED = 237;

type CloneParams = {
  readonly template: Session;
  readonly count: number;
  readonly prefix: string;
  readonly isArchived: boolean;
};

const DONE_TEMPLATE_ID = brandId<SessionId>({ value: 'mock-board-session-lockfile-bump' });

const AT = brandId<IsoDateTime>({ value: '2026-10-07T09:00:00.000Z' });

const cloneSessions = ({ template, count, prefix, isArchived }: CloneParams) =>
  Array.from({ length: count }, (_, index): Session => {
    const clone: Session = {
      ...template,
      id: brandId<SessionId>({ value: `${prefix}-${index + 1}` }),
      goal: `${template.goal} ${index + 1}`,
    };
    return isArchived ? { ...clone, archivedAt: AT } : clone;
  });

type MergedParams = {
  readonly number: number;
};

const mergedGithub = ({ number }: MergedParams) => ({
  fetchedAt: AT,
  pr: {
    number,
    title: `Change ${number}`,
    url: `https://example.invalid/harborline/pull/${number}`,
    state: 'merged' as const,
    mergeable: null,
    checks: 'success' as const,
    baseBranch: 'main',
    headBranch: `hl/change-${number}`,
    isDraft: false,
    reviewDecision: null,
    body: '',
    updatedAt: AT,
  },
  linkedIssues: [],
  failedAt: null,
  loading: false,
  error: null,
  detail: null,
  detailFetchedAt: null,
  detailLoading: false,
  detailError: null,
});

export const seedLaneWindowBoard = (): void => {
  seedBoardScene();
  const state = useAppStore.getState();
  const doneTemplate = sessionById(state.sessions, DONE_TEMPLATE_ID);
  const archivedTemplate = state.archivedSessions[WORKSPACE_ID]?.[0];
  if (doneTemplate === undefined || archivedTemplate === undefined) {
    return;
  }
  const done = cloneSessions({
    template: doneTemplate,
    count: LANE_WINDOW_DONE,
    prefix: 'mock-lane-window-done',
    isArchived: false,
  });
  const archived = cloneSessions({
    template: archivedTemplate,
    count: LANE_WINDOW_ARCHIVED,
    prefix: 'mock-lane-window-archived',
    isArchived: true,
  });
  useAppStore.setState({
    sessions: [...state.sessions, ...done],
    archivedSessions: { [WORKSPACE_ID]: archived },
    sessionGithub: {
      ...state.sessionGithub,
      ...Object.fromEntries(
        done.map((session, index) => [session.id, mergedGithub({ number: 500 + index })]),
      ),
    },
  });
};
