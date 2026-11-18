type Counts = {
  readonly comments: number;
  readonly notes: number;
};

const countedNoun = ({ count, noun }: { readonly count: number; readonly noun: string }): string =>
  count === 1 ? `1 ${noun}` : `${count} ${noun}s`;

const phraseOf = ({ comments, notes }: Counts): string => {
  if (notes === 0) {
    return countedNoun({ count: comments, noun: 'comment' });
  }
  if (comments === 0) {
    return countedNoun({ count: notes, noun: 'note' });
  }
  return `${countedNoun({ count: comments, noun: 'comment' })} and ${countedNoun({ count: notes, noun: 'note' })}`;
};

export const needsYouWords = (counts: Counts): string =>
  `${phraseOf(counts)} ${counts.comments + counts.notes === 1 ? 'needs' : 'need'} you`;

export const couldntFixWords = (counts: Counts): string => `${phraseOf(counts)} failed`;

export const pushFailedWords = ({ count }: { readonly count: number }): string =>
  count === 1 ? "1 comment didn't go out" : `${count} comments didn't go out`;
