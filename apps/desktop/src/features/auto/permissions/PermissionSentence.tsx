import type { LeadPermissions } from '@goodboy/core/auto';
import { permissionSentenceOf } from './permissionSentenceOf';

type Props = {
  readonly permissions: LeadPermissions;
  readonly isForLead: boolean;
};

export const PermissionSentence = ({ permissions, isForLead }: Props) => {
  const parts = permissionSentenceOf({ permissions, isForLead });
  return (
    <p
      data-permission-sentence=""
      className="rounded-md bg-selected px-3 py-2 text-meta text-muted-foreground"
    >
      {parts.subject} you before:{' '}
      <span className="text-foreground">
        {parts.asks.length === 0 ? 'nothing' : parts.asks.join(', ')}
      </span>
      . {parts.limit} {parts.closing}
    </p>
  );
};
