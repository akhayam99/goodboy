import { cn, Eyebrow } from '@goodboy/ui';
import { PromptField } from '../../../shared/components/PromptField';
import { AGENT_FORM_GRAMMAR } from '../agent-form-grammar';

type Props = {
  readonly value: string;
  readonly onChange: (value: string) => void;
  readonly disabled: boolean;
  readonly className?: string;
};

export const AgentInstructionsField = ({ value, onChange, disabled, className }: Props) => (
  <div className={cn('flex flex-col gap-1', className)}>
    <span className="flex items-baseline gap-1.5">
      <Eyebrow label={AGENT_FORM_GRAMMAR.instructions.label} />
      <span className="text-secondary lowercase tracking-normal text-faint-foreground">
        {AGENT_FORM_GRAMMAR.instructions.optional}
      </span>
    </span>
    <PromptField
      kind="document"
      label={AGENT_FORM_GRAMMAR.instructions.ariaLabel}
      value={value}
      onChange={onChange}
      disabled={disabled}
      placeholder={AGENT_FORM_GRAMMAR.instructions.placeholder}
      minRows={2}
      maxRows={8}
      textClassName="text-label"
    />
  </div>
);
