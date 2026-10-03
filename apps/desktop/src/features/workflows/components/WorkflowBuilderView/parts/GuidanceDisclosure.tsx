import { useState, type ReactNode } from 'react';
import { Plus } from 'lucide-react';
import { ICON_SIZE } from '../../../../../shared/components/conceptIcons';
import { PromptField } from '../../../../../shared/components/PromptField';
import { StepTreeGutter } from '../../StepTree/StepTreeGutter';

type Props = {
  readonly identityIndex: number;
  readonly guidance: string;
  readonly disabled: boolean;
  readonly footer?: ReactNode;
  readonly onGuidance: (guidance: string) => void;
};

const GUIDANCE_ID = 'orchestrated-workflow-guidance';

export const GuidanceDisclosure = ({
  identityIndex,
  guidance,
  disabled,
  footer = null,
  onGuidance,
}: Props) => {
  const [isOpen, setIsOpen] = useState(() => guidance.trim() !== '');
  const [shouldFocus, setShouldFocus] = useState(false);

  return (
    <div className="flex min-w-0 gap-1.5">
      <StepTreeGutter span="through" identityIndex={identityIndex} />
      {isOpen ? (
        <div className="flex min-w-0 flex-1 flex-col gap-1 pl-2">
          <label htmlFor={GUIDANCE_ID} className="text-secondary text-muted-foreground">
            Guidance (optional)
          </label>
          <PromptField
            kind="document"
            label="Guidance (optional)"
            id={GUIDANCE_ID}
            value={guidance}
            onChange={onGuidance}
            onBlur={() => {
              if (guidance.trim() === '') {
                setIsOpen(false);
              }
            }}
            placeholder="anything to respect or avoid, and when to stop (e.g. leave the payments module alone, stop once the PR is open)…"
            autoFocus={shouldFocus}
            hasPreview
            minRows={3}
            maxRows={7}
            disabled={disabled}
          />
          {footer}
        </div>
      ) : (
        <button
          type="button"
          onClick={() => {
            setShouldFocus(true);
            setIsOpen(true);
          }}
          disabled={disabled}
          className="flex h-7 min-w-0 items-center gap-2 rounded-md px-2 text-label text-faint-foreground transition-colors hover:bg-hover hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Plus size={ICON_SIZE.row} aria-hidden />
          <span>Add guidance for the orchestrator</span>
          <span className="text-faint-foreground">(optional)</span>
        </button>
      )}
    </div>
  );
};
