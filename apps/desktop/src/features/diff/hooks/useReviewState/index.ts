import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { REVIEW_SOURCE_LABEL } from '@goodboy/core';
import type { FileDiff, PrReviewDraft, SessionId } from '@goodboy/types';
import { EMPTY_ARRAY, useAppStore } from '../../../../store';
import { selectMountForPath } from '../../../../store/slices/project-mounts/selectors';
import { isFileLevelDraft } from '../../../../store/slices/review-drafts/fileLevel';
import { resolveReviewTarget } from '../../../../store/slices/review-drafts/resolveReviewTarget';
import { draftThread } from '../../lib/draftThreads';
import { topFolderOf } from '../../lib/topFolderOf';
import { NO_KINDS, type CommentKinds } from '../../lib/commentKinds';
import type { DiffComments, DiffThread, DiffViewed } from '../../components/DiffView/types';
import {
  ancestorIds,
  buildChangeTree,
  filterFiles,
  type ChangeTree,
  type TreeGroup,
} from '../../lib/changeTree';
import type { SessionDiff } from '../useSessionDiff';
import { useDiffNotes } from '../useDiffNotes';
import { useDiffReviewThreads } from '../useDiffReviewThreads';
import { useFoldState } from '../useFoldState';

type Params = {
  readonly sessionId: SessionId;
  readonly worktreePath: string | null;
  readonly diff: SessionDiff;
};

export type ReviewState = {
  readonly tree: ChangeTree;
  readonly allFiles: ReadonlyArray<FileDiff>;
  readonly query: string;
  readonly setQuery: (query: string) => void;
  readonly unviewedOnly: boolean;
  readonly setUnviewedOnly: (next: boolean) => void;
  readonly commentedOnly: boolean;
  readonly setCommentedOnly: (next: boolean) => void;
  readonly folder: string | null;
  readonly group: TreeGroup;
  readonly setGroup: (group: TreeGroup) => void;
  readonly isFiltering: boolean;
  readonly clearFilters: () => void;
  readonly comments: DiffComments;
  readonly viewed: DiffViewed;
  readonly commentCountOf: (path: string) => number;
  readonly kindsOf: (path: string) => CommentKinds;
  readonly activePath: string | null;
  readonly setActivePath: (path: string) => void;
  readonly collapsed: ReadonlySet<string>;
  readonly toggleFolder: (id: string) => void;
  readonly jumpTo: (path: string) => void;
  readonly stepTo: (path: string) => void;
  readonly registerScroller: (scroll: ((path: string) => void) | null) => void;
  readonly registerFileFocus: (focus: ((path: string) => void) | null) => void;
  readonly focusFile: (path: string) => void;
};

const NO_THREADS: ReadonlyArray<DiffThread> = [];

export const useReviewState = ({ sessionId, worktreePath, diff }: Params): ReviewState => {
  const noteComments = useDiffNotes({ sessionId });
  const mountId = useAppStore(
    (s) => selectMountForPath({ state: s, sessionId, path: worktreePath })?.mountId ?? null,
  );
  const review = useDiffReviewThreads({ sessionId, mountId });
  const reviewThreads = review.threads;
  const hasPullRequest = useAppStore((s) => resolveReviewTarget({ state: s, sessionId }) !== null);
  const reviewDrafts = useAppStore(
    (s) => s.reviewDrafts[sessionId] ?? (EMPTY_ARRAY as ReadonlyArray<PrReviewDraft>),
  );
  const loadReviewDrafts = useAppStore((s) => s.loadReviewDrafts);
  const updateReviewDraft = useAppStore((s) => s.updateReviewDraft);
  const discardReviewDraft = useAppStore((s) => s.discardReviewDraft);

  useEffect(() => {
    if (hasPullRequest) {
      void loadReviewDrafts(sessionId);
    }
  }, [hasPullRequest, loadReviewDrafts, sessionId]);

  const fileDraftThreads = useMemo(
    () =>
      hasPullRequest
        ? reviewDrafts
            .filter((draft) => draft.status === 'draft' && isFileLevelDraft({ draft }))
            .map(draftThread)
        : NO_THREADS,
    [hasPullRequest, reviewDrafts],
  );

  const comments = useMemo<DiffComments>(() => {
    const threads = [...noteComments.threads, ...reviewThreads, ...fileDraftThreads];
    const withHost: DiffComments = {
      ...noteComments,
      threads,
      onReply: review.onReply,
      onResolve: review.onResolve,
      onOpenInComments: review.onOpenInComments,
    };
    if (fileDraftThreads.length === 0) {
      return withHost;
    }
    const draftIds = new Set(fileDraftThreads.map((thread) => thread.id));
    return {
      ...withHost,
      onEdit: (id, body) => {
        if (draftIds.has(id)) {
          return updateReviewDraft(id, body);
        }
        return noteComments.onEdit?.(id, body) ?? Promise.resolve();
      },
      onDelete: (id) => {
        if (draftIds.has(id)) {
          void discardReviewDraft(id);
          return;
        }
        noteComments.onDelete?.(id);
      },
    };
  }, [
    discardReviewDraft,
    fileDraftThreads,
    noteComments,
    review,
    reviewThreads,
    updateReviewDraft,
  ]);
  const [query, setQuery] = useState('');
  const [unviewedOnly, setUnviewedOnly] = useState(false);
  const [commentedOnly, setCommentedOnly] = useState(false);
  const [group, setGroup] = useState<TreeGroup>('folders');
  const { stateOf } = diff.viewed;
  const folder = useAppStore((s) => s.branchFilesFolder[sessionId] ?? null);
  const setBranchFilesFolder = useAppStore((s) => s.setBranchFilesFolder);
  const isFiltering = query.trim() !== '' || unviewedOnly || commentedOnly || folder !== null;
  const [activePath, setActivePath] = useState<string | null>(null);
  const { collapsed, toggleFolder, openFolders } = useFoldState({
    sessionId,
    mountId,
    files: diff.files,
  });
  const scroller = useRef<((path: string) => void) | null>(null);
  const registerScroller = useCallback((scroll: ((path: string) => void) | null) => {
    scroller.current = scroll;
  }, []);
  const fileFocuser = useRef<((path: string) => void) | null>(null);
  const registerFileFocus = useCallback((focus: ((path: string) => void) | null) => {
    fileFocuser.current = focus;
  }, []);
  const focusFile = useCallback((path: string) => fileFocuser.current?.(path), []);

  const kindCounts = useMemo(() => {
    const counts = new Map<string, CommentKinds>();
    for (const thread of comments.threads) {
      if (thread.isResolved) {
        continue;
      }
      const current = counts.get(thread.filePath) ?? NO_KINDS;
      counts.set(
        thread.filePath,
        thread.source === 'host'
          ? {
              ...current,
              host: current.host + 1,
              hostLabel:
                thread.host === null ? current.hostLabel : REVIEW_SOURCE_LABEL[thread.host],
            }
          : { ...current, notes: current.notes + 1 },
      );
    }
    return counts;
  }, [comments.threads]);
  const kindsOf = useCallback((path: string) => kindCounts.get(path) ?? NO_KINDS, [kindCounts]);
  const commentCountOf = useCallback(
    (path: string) => {
      const kinds = kindCounts.get(path) ?? NO_KINDS;
      return kinds.notes + kinds.host;
    },
    [kindCounts],
  );

  const shownFiles = useMemo(() => {
    if (!isFiltering) {
      return diff.files;
    }
    return filterFiles({ files: diff.files, query }).filter(
      (file) =>
        (folder === null || topFolderOf({ path: file.path }) === folder) &&
        (!unviewedOnly || stateOf(file) !== 'viewed') &&
        (!commentedOnly || commentCountOf(file.path) > 0),
    );
  }, [
    commentCountOf,
    commentedOnly,
    diff.files,
    folder,
    isFiltering,
    query,
    stateOf,
    unviewedOnly,
  ]);
  const tree = useMemo(() => buildChangeTree({ files: shownFiles, group }), [group, shownFiles]);
  const rowsRef = useRef(tree.rows);
  rowsRef.current = tree.rows;

  const clearFilters = useCallback(() => {
    setQuery('');
    setUnviewedOnly(false);
    setCommentedOnly(false);
    setBranchFilesFolder({ sessionId, folder: null });
  }, [sessionId, setBranchFilesFolder]);

  const reveal = useCallback(
    (path: string) => openFolders(ancestorIds({ rows: rowsRef.current, path })),
    [openFolders],
  );

  const { focusPath } = diff;
  const revealRef = useRef(reveal);
  revealRef.current = reveal;
  useEffect(() => {
    if (focusPath !== null) {
      revealRef.current(focusPath);
    }
  }, [focusPath, tree]);

  const jumpTo = useCallback(
    (path: string) => {
      setActivePath(path);
      reveal(path);
      scroller.current?.(path);
    },
    [reveal],
  );

  const stepTo = useCallback((path: string) => {
    setActivePath(path);
    scroller.current?.(path);
  }, []);

  return {
    tree,
    allFiles: diff.files,
    query,
    setQuery,
    unviewedOnly,
    setUnviewedOnly,
    commentedOnly,
    setCommentedOnly,
    folder,
    group,
    setGroup,
    isFiltering,
    clearFilters,
    comments,
    viewed: diff.viewed,
    commentCountOf,
    kindsOf,
    activePath,
    setActivePath,
    collapsed,
    toggleFolder,
    jumpTo,
    stepTo,
    registerScroller,
    registerFileFocus,
    focusFile,
  };
};
