import { Person } from '../Person';
import type { ActivityLead } from './activityRowOf';

type Props = {
  readonly lead: ActivityLead;
};

export const ActivityLeadMark = ({ lead }: Props) =>
  lead.kind === 'person' ? (
    <span className="flex size-6 shrink-0 items-center justify-center">
      <Person
        login={lead.login}
        avatarUrl={lead.avatarUrl}
        size="md"
        isBot={lead.isBot}
        isNameHidden
      />
    </span>
  ) : (
    <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-subtle text-muted-foreground">
      {lead.glyph}
    </span>
  );
