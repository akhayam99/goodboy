import type { PrReviewDraft } from '@goodboy/types';
import type { DiffThread } from '../../../../diff/components/DiffView/types';

export const draftThread = (draft: PrReviewDraft): DiffThread => {
  const start = draft.startLine ?? draft.line;
  const lo = Math.min(start, draft.line);
  const hi = Math.max(start, draft.line);
  return {
    id: draft.id,
    filePath: draft.path,
    anchor: { side: draft.side, lineNumber: lo, ...(hi > lo ? { endLineNumber: hi } : {}) },
    body: draft.body,
    tone: draft.stale ? 'warning' : 'draft',
    author: draft.origin === 'agent' ? 'Agent' : 'You',
    isAgent: draft.origin === 'agent',
    createdAt: draft.createdAt,
    statusLabel: draft.stale ? 'Stale, skipped on submit' : 'Draft',
    isResolved: false,
    canEdit: true,
    canResolve: false,
    canReopen: false,
  };
};
