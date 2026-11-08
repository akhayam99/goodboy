import type { AutoDelegation } from '@goodboy/db';
import { recordField, textField } from './chat/readJson';

const AUTO_CONTINUE_SOURCES = ['auto', 'auto-message', 'user'] as const;

export type AutoContinueSource = (typeof AUTO_CONTINUE_SOURCES)[number];

export type AutoContinue = Readonly<{
  from: AutoContinueSource;
  text: string;
}>;

type Params = {
  readonly delegation: Pick<AutoDelegation, 'request'>;
};

export const delegationContinueOf = ({ delegation }: Params): AutoContinue | null => {
  const given = recordField({ source: delegation.request, key: 'continueWith' });
  if (given === null) {
    return null;
  }
  const from = AUTO_CONTINUE_SOURCES.find(
    (source) => source === textField({ source: given, key: 'from' }),
  );
  const text = textField({ source: given, key: 'text' });
  return from === undefined || text === null ? null : { from, text };
};
