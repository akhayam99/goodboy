import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { FileDiff, PrReviewDraft, SessionId } from '@goodboy/types';
import { EMPTY_ARRAY, useAppStore } from '../../../../store';
import { selectMountForPath } from '../../../../store/slices/project-mounts/selectors';
import { isFileLevelDraft } from '../../../../store/slices/review-drafts/fileLevel';
import { resolveReviewTarget } from '../../../../store/slices/review-drafts/resolveReviewTarget';
import { draftThread } from '../../lib/draftThreads';
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
  readonly notesOnly: boolean;
  readonly setNotesOnly: (next: boolean) => void;
  readonly group: TreeGroup;
  readonly setGroup: (group: TreeGroup) => void;
  readonly isFiltering: boolean;
  readonly clearFilters: () => void;
  readonly comments: DiffComments;
  readonly viewed: DiffViewed;
  readonly noteCountOf: (path: string) => number;
  readonly hasNotesIn: (path: string) => boolean;
  readonly activePath: string | null;
  readonly setActivePath: (path: string) => void;
  readonly collapsed: ReadonlySet<string>;
  readonly toggleFolder: (id: string) => void;
  readonly jumpTo: (path: string) => void;
  readonly stepTo: (path: string) => void;
  readonly registerScroller: (scroll: ((path: string) => void) | null) => void;
  readonly fileCommentPath: string | null;
  readonly commentOnFile: (path: string) => void;
  readonly clearFileComment: () => void;
};

const NO_THREADS: ReadonlyArray<DiffThread> = [];

export const useReviewState = ({ sessionId, worktreePath, diff }: Params): ReviewState => {
  const { comments: noteComments, fixes } = useDiffNotes({ sessionId });
  const mountId = useAppStore(
    (s) => selectMountForPath({ state: s, sessionId, path: worktreePath })?.mountId ?? null,
  );
  const reviewThreads = useDiffReviewThreads({ sessionId, mountId });
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
    if (fileDraftThreads.length === 0) {
      return reviewThreads.length === 0 ? noteComments : { ...noteComments, threads };
    }
    const draftIds = new Set(fileDraftThreads.map((thread) => thread.id));
    return {
      ...noteComments,
      threads,
      onEdit: (id, body) => {
        if (draftIds.has(id)) {
          void updateReviewDraft(id, body);
        }
      },
      onDelete: (id) => {
        if (draftIds.has(id)) {
          void discardReviewDraft(id);
          return;
        }
        noteComments.onDelete?.(id);
      },
    };
  }, [discardReviewDraft, fileDraftThreads, noteComments, reviewThreads, updateReviewDraft]);
  const [query, setQuery] = useState('');
  const [unviewedOnly, setUnviewedOnly] = useState(false);
  const [notesOnly, setNotesOnly] = useState(false);
  const [group, setGroup] = useState<TreeGroup>('folders');
  const { stateOf } = diff.viewed;
  const isFiltering = query.trim() !== '' || unviewedOnly || notesOnly;
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

  const noteCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const thread of comments.threads) {
      if (!thread.isResolved) {
        counts.set(thread.filePath, (counts.get(thread.filePath) ?? 0) + 1);
      }
    }
    return counts;
  }, [comments.threads]);
  const noteCountOf = useCallback((path: string) => noteCounts.get(path) ?? 0, [noteCounts]);
  const notePaths = useMemo(
    () => new Set(fixes.filter((fix) => !fix.isClosed).map((fix) => fix.note.filePath)),
    [fixes],
  );
  const hasNotesIn = useCallback((path: string) => notePaths.has(path), [notePaths]);

  const shownFiles = useMemo(() => {
    if (!isFiltering) {
      return diff.files;
    }
    return filterFiles({ files: diff.files, query }).filter(
      (file) =>
        (!unviewedOnly || stateOf(file) !== 'viewed') &&
        (!notesOnly || (noteCounts.get(file.path) ?? 0) > 0),
    );
  }, [diff.files, isFiltering, noteCounts, notesOnly, query, stateOf, unviewedOnly]);
  const tree = useMemo(() => buildChangeTree({ files: shownFiles, group }), [group, shownFiles]);
  const rowsRef = useRef(tree.rows);
  rowsRef.current = tree.rows;

  const clearFilters = useCallback(() => {
    setQuery('');
    setUnviewedOnly(false);
    setNotesOnly(false);
  }, []);

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

  const [fileCommentPath, setFileCommentPath] = useState<string | null>(null);
  const commentOnFile = useCallback(
    (path: string) => {
      jumpTo(path);
      setFileCommentPath(path);
    },
    [jumpTo],
  );
  const clearFileComment = useCallback(() => setFileCommentPath(null), []);

  return {
    tree,
    allFiles: diff.files,
    query,
    setQuery,
    unviewedOnly,
    setUnviewedOnly,
    notesOnly,
    setNotesOnly,
    group,
    setGroup,
    isFiltering,
    clearFilters,
    comments,
    viewed: diff.viewed,
    noteCountOf,
    hasNotesIn,
    activePath,
    setActivePath,
    collapsed,
    toggleFolder,
    jumpTo,
    stepTo,
    registerScroller,
    fileCommentPath,
    commentOnFile,
    clearFileComment,
  };
};
