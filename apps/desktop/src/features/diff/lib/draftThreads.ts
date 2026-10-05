import type { PrReviewDraft } from '@goodboy/types';
import { isFileLevelDraft } from '../../../store/slices/review-drafts/fileLevel';
import type { DiffThread } from '../components/DiffView/types';

export const FILE_DRAFT_COMPOSER = {
  label: 'Draft on this file',
  submitLabel: 'Add draft',
} as const;

const anchorOf = (draft: PrReviewDraft): DiffThread['anchor'] => {
  if (isFileLevelDraft({ draft })) {
    return null;
  }
  const start = draft.startLine ?? draft.line;
  const lo = Math.min(start, draft.line);
  const hi = Math.max(start, draft.line);
  return { side: draft.side, lineNumber: lo, ...(hi > lo ? { endLineNumber: hi } : {}) };
};

export const draftThread = (draft: PrReviewDraft): DiffThread => {
  return {
    id: draft.id,
    filePath: draft.path,
    anchor: anchorOf(draft),
    body: draft.body,
    tone: draft.stale ? 'warning' : 'draft',
    author: draft.origin === 'agent' ? 'Agent' : 'You',
    isAgent: draft.origin === 'agent',
    createdAt: draft.createdAt,
    statusLabel: draft.stale ? 'Stale, skipped on submit' : 'Draft',
    isResolved: false,
    canEdit: true,
    canClose: false,
    canReopen: false,
  };
};
