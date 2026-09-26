import { useState } from 'react';
import { Plus } from 'lucide-react';
import { Textarea } from '@goodboy/ui';
import { ICON_SIZE } from '../../../../../shared/components/conceptIcons';
import { StepTreeGutter } from '../../../../workflows/components/StepTree/StepTreeGutter';

type Props = {
  readonly identityIndex: number;
  readonly guidance: string;
  readonly disabled: boolean;
  readonly onGuidance: (guidance: string) => void;
};

const GUIDANCE_ID = 'orchestrated-workflow-guidance';

export const GuidanceDisclosure = ({ identityIndex, guidance, disabled, onGuidance }: Props) => {
  const [isOpen, setIsOpen] = useState(() => guidance.trim() !== '');
  const [shouldFocus, setShouldFocus] = useState(false);

  return (
    <div className="flex min-w-0 gap-1.5">
      <StepTreeGutter span="none" identityIndex={identityIndex} />
      {isOpen ? (
        <div className="flex min-w-0 flex-1 flex-col gap-1 pl-2">
          <label htmlFor={GUIDANCE_ID} className="text-secondary text-muted-foreground">
            Guidance (optional)
          </label>
          <Textarea
            id={GUIDANCE_ID}
            value={guidance}
            onChange={(event) => onGuidance(event.target.value)}
            onBlur={() => {
              if (guidance.trim() === '') {
                setIsOpen(false);
              }
            }}
            placeholder="anything to respect or avoid, and when to stop (e.g. leave the payments module alone, stop once the PR is open)…"
            autoFocus={shouldFocus}
            autoGrow
            minRows={3}
            maxRows={7}
            disabled={disabled}
            className="resize-none bg-subtle text-body"
          />
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
