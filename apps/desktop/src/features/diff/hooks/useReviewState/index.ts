import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { FileDiff, PrReviewDraft, SessionId } from '@goodboy/types';
import { EMPTY_ARRAY, useAppStore } from '../../../../store';
import { selectMountForPath } from '../../../../store/slices/project-mounts/selectors';
import {
  FILE_LEVEL_LINE,
  isFileLevelDraft,
} from '../../../../store/slices/review-drafts/fileLevel';
import { resolveReviewTarget } from '../../../../store/slices/review-drafts/resolveReviewTarget';
import { FILE_DRAFT_COMPOSER, draftThread } from '../../lib/draftThreads';
import type { DiffComments, DiffThread, DiffViewed } from '../../components/DiffView/types';
import {
  GENERATED_GROUP_ID,
  ancestorIds,
  buildChangeTree,
  filterFiles,
  type ChangeTree,
  type TreeGroup,
} from '../../lib/changeTree';
import type { SessionDiff } from '../useSessionDiff';
import { useDiffNotes } from '../useDiffNotes';
import { useDiffReviewThreads } from '../useDiffReviewThreads';

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
  readonly activePath: string | null;
  readonly setActivePath: (path: string) => void;
  readonly collapsed: ReadonlySet<string>;
  readonly toggleFolder: (id: string) => void;
  readonly jumpTo: (path: string) => void;
  readonly fileCommentPath: string | null;
  readonly commentOnFile: (path: string) => void;
  readonly clearFileComment: () => void;
};

const INITIALLY_COLLAPSED: ReadonlySet<string> = new Set([GENERATED_GROUP_ID]);

const NO_THREADS: ReadonlyArray<DiffThread> = [];

export const useReviewState = ({ sessionId, worktreePath, diff }: Params): ReviewState => {
  const { comments: noteComments } = useDiffNotes({ sessionId });
  const mountId = useAppStore(
    (s) => selectMountForPath({ state: s, sessionId, path: worktreePath })?.mountId ?? null,
  );
  const reviewThreads = useDiffReviewThreads({ sessionId, mountId });
  const hasPullRequest = useAppStore((s) => resolveReviewTarget({ state: s, sessionId }) !== null);
  const reviewDrafts = useAppStore(
    (s) => s.reviewDrafts[sessionId] ?? (EMPTY_ARRAY as ReadonlyArray<PrReviewDraft>),
  );
  const loadReviewDrafts = useAppStore((s) => s.loadReviewDrafts);
  const addReviewDraft = useAppStore((s) => s.addReviewDraft);
  const updateReviewDraft = useAppStore((s) => s.updateReviewDraft);
  const discardReviewDraft = useAppStore((s) => s.discardReviewDraft);
  const reportError = useAppStore((s) => s.reportError);

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
    if (!hasPullRequest) {
      return reviewThreads.length === 0 ? noteComments : { ...noteComments, threads };
    }
    const draftIds = new Set(fileDraftThreads.map((thread) => thread.id));
    return {
      ...noteComments,
      threads,
      fileComposer: FILE_DRAFT_COMPOSER,
      onSubmit: (filePath, anchor, body) => {
        if (anchor !== null) {
          noteComments.onSubmit(filePath, anchor, body);
          return;
        }
        addReviewDraft({ sessionId, path: filePath, line: FILE_LEVEL_LINE, body }).catch(
          (err: unknown) =>
            reportError({ title: "Couldn't save the review comment", error: err, sessionId }),
        );
      },
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
  }, [
    addReviewDraft,
    discardReviewDraft,
    fileDraftThreads,
    hasPullRequest,
    noteComments,
    reportError,
    reviewThreads,
    sessionId,
    updateReviewDraft,
  ]);
  const [query, setQuery] = useState('');
  const [unviewedOnly, setUnviewedOnly] = useState(false);
  const [notesOnly, setNotesOnly] = useState(false);
  const [group, setGroup] = useState<TreeGroup>('folders');
  const { stateOf } = diff.viewed;
  const isFiltering = query.trim() !== '' || unviewedOnly || notesOnly;
  const [activePath, setActivePath] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(INITIALLY_COLLAPSED);
  const { focusFile } = diff;

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

  const shownFiles = useMemo(
    () =>
      filterFiles({ files: diff.files, query }).filter(
        (file) =>
          (!unviewedOnly || stateOf(file) !== 'viewed') &&
          (!notesOnly || (noteCounts.get(file.path) ?? 0) > 0),
      ),
    [diff.files, noteCounts, notesOnly, query, stateOf, unviewedOnly],
  );
  const tree = useMemo(() => buildChangeTree({ files: shownFiles, group }), [group, shownFiles]);
  const rowsRef = useRef(tree.rows);
  rowsRef.current = tree.rows;

  const clearFilters = useCallback(() => {
    setQuery('');
    setUnviewedOnly(false);
    setNotesOnly(false);
  }, []);

  const reveal = useCallback((path: string) => {
    const ancestors = ancestorIds({ rows: rowsRef.current, path });
    setCollapsed((current) => {
      if (!ancestors.some((id) => current.has(id))) {
        return current;
      }
      const next = new Set(current);
      for (const id of ancestors) {
        next.delete(id);
      }
      return next;
    });
  }, []);

  useEffect(() => {
    if (activePath !== null) {
      reveal(activePath);
    }
  }, [activePath, reveal]);

  const toggleFolder = useCallback((id: string) => {
    setCollapsed((current) => {
      const next = new Set(current);
      if (!next.delete(id)) {
        next.add(id);
      }
      return next;
    });
  }, []);

  const jumpTo = useCallback(
    (path: string) => {
      setActivePath(path);
      reveal(path);
      focusFile(path);
    },
    [focusFile, reveal],
  );

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
    activePath,
    setActivePath,
    collapsed,
    toggleFolder,
    jumpTo,
    fileCommentPath,
    commentOnFile,
    clearFileComment,
  };
};
