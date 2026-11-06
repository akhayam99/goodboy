export const cx = (...names: readonly (string | false | null | undefined)[]): string =>
  names.filter(Boolean).join(' ');

export const nodeIndexOf = (stepLabel: string | undefined): string | undefined =>
  stepLabel === undefined ? undefined : stepLabel.split('.').at(-1);
