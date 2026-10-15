import { useState, type ReactNode } from 'react';
import { Plus, SlidersHorizontal } from 'lucide-react';
import { Button } from '@goodboy/ui';
import { ICON_SIZE } from '../../../../../shared/components/conceptIcons';
import { PromptField } from '../../../../../shared/components/PromptField';
import { RuleDot } from './RuleDot';

type Props = {
  readonly guidance: string;
  readonly ruleSummary: string;
  readonly hasDiff: boolean;
  readonly isDisabled: boolean;
  readonly tools: ReactNode;
  readonly footer?: ReactNode;
  readonly onGuidance: (guidance: string) => void;
};

const RUN_GUIDANCE_ID = 'workflow-run-guidance';

const PREVIEW_LINES = 2;

type PreviewParams = {
  readonly guidance: string;
};

const previewLinesOf = ({ guidance }: PreviewParams): ReadonlyArray<string> =>
  guidance
    .split('\n')
    .filter((line) => line.trim() !== '')
    .slice(0, PREVIEW_LINES);

export const RunGuidance = ({
  guidance,
  ruleSummary,
  hasDiff,
  isDisabled,
  tools,
  footer = null,
  onGuidance,
}: Props) => {
  const [isEditing, setIsEditing] = useState(false);
  const isEmpty = guidance.trim() === '';

  if (isEditing) {
    return (
      <section aria-label="Guidance" className="flex min-w-0 flex-col gap-2">
        <div className="flex items-center gap-2">
          <span className="text-label text-foreground">Guidance</span>
          {hasDiff ? <RuleDot ruleValue={ruleSummary} /> : null}
          <span className="text-meta text-faint-foreground">How to work, kept for every run</span>
        </div>
        <PromptField
          kind="document"
          label="Run guidance"
          id={RUN_GUIDANCE_ID}
          value={guidance}
          onChange={onGuidance}
          onBlur={() => {
            if (guidance.trim() === '') {
              setIsEditing(false);
            }
          }}
          placeholder="Anything every agent that writes code should respect, one per line"
          autoFocus
          disabled={isDisabled}
          hasPreview
          minRows={2}
          maxRows={8}
        />
        {tools}
        {footer}
        {isEmpty ? null : (
          <div className="flex justify-end">
            <Button variant="secondary" size="sm" onClick={() => setIsEditing(false)}>
              Done
            </Button>
          </div>
        )}
      </section>
    );
  }

  if (isEmpty) {
    return (
      <section aria-label="Guidance" className="flex min-w-0 flex-col">
        <button
          type="button"
          onClick={() => setIsEditing(true)}
          disabled={isDisabled}
          className="flex min-h-8 min-w-0 items-center gap-2 rounded-md text-label text-foreground transition-colors hover:bg-hover disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Plus size={ICON_SIZE.row} aria-hidden className="shrink-0 text-muted-foreground" />
          <span>Add guidance</span>
          <span className="truncate text-faint-foreground">How to work, kept for every run</span>
        </button>
      </section>
    );
  }

  return (
    <section aria-label="Guidance" className="flex min-w-0 flex-col gap-1">
      <div className="flex min-w-0 items-center gap-2">
        <span className="text-label text-foreground">Guidance</span>
        {hasDiff ? (
          <RuleDot ruleValue={ruleSummary} />
        ) : (
          <span className="inline-flex shrink-0 items-center gap-1 text-meta text-faint-foreground">
            <SlidersHorizontal size={ICON_SIZE.row} aria-hidden />
            From your rules
          </span>
        )}
        <span className="flex-1" />
        <Button variant="ghost" size="sm" onClick={() => setIsEditing(true)} disabled={isDisabled}>
          Edit
        </Button>
      </div>
      <div data-testid="guidance-preview" className="flex min-w-0 flex-col">
        {previewLinesOf({ guidance }).map((line, index) => (
          <p key={`${index}-${line}`} className="truncate text-label text-muted-foreground">
            {line}
          </p>
        ))}
      </div>
    </section>
  );
};
