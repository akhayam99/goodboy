export const unsentCommentsQuestion = ({ count }: { readonly count: number }): string =>
  `${count === 1 ? '1 comment is' : `${count} comments are`} not sent. Approve anyway?`;
