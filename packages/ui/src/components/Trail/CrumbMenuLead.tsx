import type { CrumbLead } from './crumbMenuTypes';
import { ICON_SIZE } from '../../iconSize';

type Props = {
  readonly lead: CrumbLead;
};

export const CrumbMenuLead = ({ lead }: Props) => {
  if (lead.kind === 'number') {
    return (
      <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-fill text-chip text-muted-foreground">
        {lead.value}
      </span>
    );
  }
  if (lead.kind === 'node') {
    return <span className="flex size-5 shrink-0 items-center justify-center">{lead.node}</span>;
  }
  const Icon = lead.icon;
  return (
    <span className="flex size-5 shrink-0 items-center justify-center">
      <Icon
        size={ICON_SIZE.control}
        aria-hidden
        className={lead.className ?? 'text-faint-foreground'}
      />
    </span>
  );
};
