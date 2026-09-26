import { cn, Eyebrow } from '@goodboy/ui';
import { AGENT_FORM_GRAMMAR, type AgentFormRole } from '../../agent-form-grammar';

type Props = {
  readonly role: AgentFormRole;
  readonly className?: string;
};

export const AgentRoleField = ({ role, className }: Props) => (
  <div className={cn('flex flex-col gap-0.5', className)}>
    <Eyebrow label={AGENT_FORM_GRAMMAR.role.label} />
    <span className="text-label font-medium text-foreground">{role.label}</span>
    <span className="text-2xs leading-tight text-faint-foreground">
      {role.hint ?? AGENT_FORM_GRAMMAR.role.fixedHint}
    </span>
  </div>
);
