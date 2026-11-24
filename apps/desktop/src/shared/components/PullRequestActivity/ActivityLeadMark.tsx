import { WorkNode } from '@goodboy/ui';
import { Person } from '../Person';
import type { ActivityLead } from './activityRowOf';

type Props = {
  readonly lead: ActivityLead;
};

export const ActivityLeadMark = ({ lead }: Props) => (
  <span className="flex size-6 shrink-0 items-center justify-center">
    {lead.kind === 'person' ? (
      <Person
        login={lead.login}
        avatarUrl={lead.avatarUrl}
        size="md"
        isBot={lead.isBot}
        isNameHidden
      />
    ) : (
      <span className="flex text-muted-foreground">
        <WorkNode look="quiet" state={lead.state} mark={lead.mark} label={lead.label} />
      </span>
    )}
  </span>
);
