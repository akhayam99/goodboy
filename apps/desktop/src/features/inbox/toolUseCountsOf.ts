import type { GithubInboxPrRole } from '@goodboy/types';
import {
  TOOL_USES,
  type ToolUse,
  type ToolUseCounts,
} from '../../store/slices/integrations/toolUses';
import type { InboxKind, InboxProvider, InboxRecord } from './types';

type CountedRecord = Pick<InboxRecord, 'provider' | 'state'> & {
  readonly payload: {
    readonly kind: InboxKind;
    readonly role?: GithubInboxPrRole;
  };
};

type Params = {
  readonly records: ReadonlyArray<CountedRecord>;
  readonly settled: ReadonlyArray<InboxProvider>;
};

type UseParams = {
  readonly record: CountedRecord;
};

const useOf = ({ record }: UseParams): ToolUse => {
  const { payload } = record;
  switch (payload.kind) {
    case 'pr':
      return payload.role === 'review-requested' ? 'reviews' : 'pullRequests';
    case 'mr':
      return 'mergeRequests';
    case 'thread':
      return 'threads';
    case 'issue':
    case 'error':
      return 'issues';
    default: {
      const unreachable: never = payload.kind;
      return unreachable;
    }
  }
};

export const toolUseCountsOf = ({ records, settled }: Params): ToolUseCounts =>
  Object.fromEntries(
    settled.map((provider) => {
      const open = records.filter(
        (record) => record.provider === provider && record.state !== 'done',
      );
      const counts = Object.fromEntries(
        TOOL_USES[provider].map((use) => [
          use,
          open.filter((record) => useOf({ record }) === use).length,
        ]),
      );
      return [provider, counts];
    }),
  );
