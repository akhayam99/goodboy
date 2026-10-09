export const REVIEW_NOTES_COPY = {
  title: 'Your notes',
  close: 'Close',
  jumpToLine: 'Jump to line',
  jumpToFile: 'Jump to file',
  showClosed: 'Show closed',
  hideClosed: 'Hide closed',
  closeNote: 'Close',
  closeTheNote: 'Close the note',
  deleteNote: 'Delete',
  reopen: 'Reopen',
  include: 'Include in the fix',
  openReviewDraft: 'Open review draft',
  empty: 'No open notes. Add one with Add note on a line or a file.',
  closedHeading: 'Closed',
  moreActions: 'More note actions',
} as const;

export const notesOpenCount = ({ count }: { readonly count: number }): string => `${count} open`;

export const fixNotesLabel = ({ count }: { readonly count: number }): string => `Fix ${count}`;

export const notesButtonLabel = ({ count }: { readonly count: number }): string => `Notes ${count}`;

export const olderDraftsLine = ({ count }: { readonly count: number }): string =>
  count === 1
    ? '1 older draft is in your review draft'
    : `${count} older drafts are in your review draft`;
