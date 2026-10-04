export const outputsLabel = ({ count }: { readonly count: number }): string =>
  count === 1 ? '1 output' : `${count} outputs`;
