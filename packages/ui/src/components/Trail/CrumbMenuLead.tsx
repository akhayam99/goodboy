import type { CrumbLead } from './crumbMenuTypes';

type Props = {
  readonly lead: CrumbLead;
};

export const CrumbMenuLead = ({ lead }: Props) => {
  if (lead.kind === 'number') {
    return (
      <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-fill text-3xs font-medium tabular-nums text-muted-foreground">
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
      <Icon size={14} aria-hidden className={lead.className ?? 'text-faint-foreground'} />
    </span>
  );
};
