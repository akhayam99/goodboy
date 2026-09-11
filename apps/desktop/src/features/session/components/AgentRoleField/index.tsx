import { cn } from '@goodboy/ui';
import { AGENT_FORM_GRAMMAR, type AgentFormRole } from '../../agent-form-grammar';

type Props = {
  readonly role: AgentFormRole;
  readonly className?: string;
};

export const AgentRoleField = ({ role, className }: Props) => (
  <div className={cn('flex flex-col gap-0.5', className)}>
    <span className="text-2xs font-semibold uppercase tracking-wide text-muted-foreground/80">
      {AGENT_FORM_GRAMMAR.role.label}
    </span>
    <span className="text-xs font-medium text-foreground">{role.label}</span>
    <span className="text-2xs leading-tight text-muted-foreground/60">
      {role.hint ?? AGENT_FORM_GRAMMAR.role.fixedHint}
    </span>
  </div>
);
