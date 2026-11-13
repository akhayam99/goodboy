import type { RecordSection } from '../../../../../shared/components/StudioDetail/RecordSections/types';
import type { ConversationThread } from '../../../../../shared/components/Conversation/types';
import { hostActivityOf } from '../../../../branch/hostActivityOf';
import { hostActivitySectionOf } from '../../../components/HostOverview/hostActivitySectionOf';
import type { GitlabMergeRequest } from '../../client';

type Params = {
  readonly mr: GitlabMergeRequest;
  readonly threads: ReadonlyArray<ConversationThread>;
  readonly conversation: RecordSection;
};

type EndParams = {
  readonly mr: GitlabMergeRequest;
};

const endOf = ({ mr }: EndParams) => {
  if (mr.state === 'merged') {
    return {
      kind: 'merged' as const,
      at: mr.mergedAt ?? mr.updatedAt,
      who: mr.author?.username ?? null,
      avatarUrl: mr.author?.avatarUrl ?? null,
    };
  }
  if (mr.state === 'closed') {
    return { kind: 'closed' as const, at: mr.updatedAt, who: null, avatarUrl: null };
  }
  return null;
};

export const gitlabMrSectionsOf = ({
  mr,
  conversation,
  threads,
}: Params): ReadonlyArray<RecordSection> => {
  const items = hostActivityOf({
    opened: {
      who: mr.author?.username ?? null,
      avatarUrl: mr.author?.avatarUrl ?? null,
      at: mr.createdAt ?? null,
      isDraft: mr.draft,
    },
    threads,
    end: endOf({ mr }),
  });
  return [
    ...hostActivitySectionOf({ items, host: 'gitlab', baseBranch: mr.targetBranch }),
    conversation,
  ];
};
