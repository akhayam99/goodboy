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

export const couldntFixWords = ({
  comments,
  notes,
  form,
}: Counts & { readonly form: 'status' | 'chip' }): string =>
  form === 'status'
    ? `${phraseOf({ comments, notes })} couldn't be fixed`
    : `${phraseOf({ comments, notes })} it couldn't fix`;
