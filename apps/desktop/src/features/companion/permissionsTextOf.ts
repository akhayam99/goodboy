import type { PhonePermissions } from './bridge';

type Params = {
  readonly permissions: PhonePermissions;
};

type CapitalParams = {
  readonly text: string;
};

const capitalized = ({ text }: CapitalParams): string =>
  `${text.charAt(0).toUpperCase()}${text.slice(1)}`;

export const permissionsTextOf = ({ permissions }: Params): string => {
  const words: Array<string> = [];
  if (permissions.canDecide) {
    words.push('reply', 'approve');
  }
  if (permissions.canMerge) {
    words.push('merge');
  }
  if (permissions.canStart) {
    words.push('start sessions');
  }
  const last = words.pop();
  if (last === undefined) {
    return 'Read only';
  }
  if (words.length === 0) {
    return capitalized({ text: last });
  }
  return capitalized({ text: `${words.join(', ')} and ${last}` });
};
