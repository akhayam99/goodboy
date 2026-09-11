import { Textarea, cn } from '@goodboy/ui';
import { AGENT_FORM_GRAMMAR } from '../../agent-form-grammar';

type Props = {
  readonly value: string;
  readonly onChange: (value: string) => void;
  readonly disabled: boolean;
  readonly className?: string;
};

export const AgentInstructionsField = ({ value, onChange, disabled, className }: Props) => (
  <div className={cn('flex flex-col gap-1', className)}>
    <span className="flex items-baseline gap-1.5">
      <span className="text-2xs font-semibold uppercase tracking-wide text-muted-foreground/80">
        {AGENT_FORM_GRAMMAR.instructions.label}
      </span>
      <span className="text-2xs lowercase tracking-normal text-muted-foreground/60">
        {AGENT_FORM_GRAMMAR.instructions.optional}
      </span>
    </span>
    <Textarea
      aria-label={AGENT_FORM_GRAMMAR.instructions.ariaLabel}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      disabled={disabled}
      placeholder={AGENT_FORM_GRAMMAR.instructions.placeholder}
      minRows={2}
      maxRows={8}
      autoGrow
      className="text-xs"
    />
  </div>
);
