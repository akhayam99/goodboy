export const DIFF_NOTES_LABEL = {
  drawer: 'Notes',
  closeDrawer: 'Close notes',
  openInReview: 'Open in Review',
  emptyTitle: 'No notes yet',
  emptyDescription: 'Click a line number in the diff to leave a note for the agents.',
  showDone: 'Show done notes',
} as const;

export const NOTE_ACTION_LABEL = {
  fix: 'Fix',
  openBrief: 'Open brief',
  openInReview: 'Open in Review',
} as const;

export const notesCountLabel = ({ count }: { readonly count: number }): string =>
  `${count} ${count === 1 ? 'note' : 'notes'}`;

export const fixNotesLabel = ({ count }: { readonly count: number }): string => {
  if (count === 1) {
    return 'Fix note';
  }
  return count > 1 ? `Fix ${count} notes` : 'Fix notes';
};
