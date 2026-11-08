import { isResultsPayload } from '@goodboy/core/auto';
import type { AutoDelegation, AutoOutboxRow } from '@goodboy/db';
import { isRecord } from '@goodboy/types/helpers';
import { delegationReplacesOf } from '../../../../features/auto/delegationReplacesOf';

type Params = {
  readonly row: Pick<AutoOutboxRow, 'payload'>;
  readonly delegations: ReadonlyArray<AutoDelegation>;
};

export const declinedTargetsOfRow = ({ row, delegations }: Params): ReadonlyArray<string> => {
  const payload = row.payload;
  if (!isResultsPayload(payload)) {
    return [];
  }
  return payload.results.flatMap((entry) => {
    if (!isRecord(entry) || typeof entry['delegationId'] !== 'string') {
      return [];
    }
    const id = entry['delegationId'];
    const declined = delegations.find((candidate) => candidate.id === id);
    if (
      declined === undefined ||
      declined.state !== 'settled' ||
      declined.outcome !== 'stopped' ||
      declined.reason !== 'declined'
    ) {
      return [];
    }
    const target = declined.retryOf ?? delegationReplacesOf({ delegation: declined });
    return target === null ? [] : [target];
  });
};
