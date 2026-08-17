import { Button, ScrollFade, Textarea, cn } from '@goodboy/ui';
import { CONCEPT_ICONS } from '../../../../../shared/components/conceptIcons';

type Props = {
  readonly prompt: string;
  readonly isWorking: boolean;
  readonly error: string | null;
  readonly providerReason: string | null;
  readonly onPromptChange: (value: string) => void;
  readonly onExample: (value: string) => void;
  readonly onCreate: () => void;
  readonly onBlank: () => void;
};

const EXAMPLES = [
  {
    label: 'Plan and ship',
    prompt: 'Scout the codebase, plan the change, implement it, then review the diff',
  },
  {
    label: 'Fix a bug',
    prompt: 'Investigate a bug, fix the root cause, and add regression tests',
  },
  {
    label: 'Build from a brief',
    prompt: 'Turn a product brief into a plan, implementation, and final verification',
  },
] satisfies ReadonlyArray<{ readonly label: string; readonly prompt: string }>;

export const WorkflowStarter = ({
  prompt,
  isWorking,
  error,
  providerReason,
  onPromptChange,
  onExample,
  onCreate,
  onBlank,
}: Props) => (
  <section className="flex h-full min-h-0 flex-1 items-center justify-center overflow-hidden px-6 py-5">
    <div
      className={cn(
        'flex max-h-full min-h-0 w-full max-w-2xl flex-col gap-6 rounded-lg border bg-subtle p-5',
        isWorking ? 'spin-border spin-border-info border-info/50' : 'border-border-soft',
      )}
    >
      <div className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold text-foreground">Build a workflow</h2>
        <p className="max-w-prose text-sm text-muted-foreground">
          Describe the outcome and the handoffs. An agent will write the steps for you.
        </p>
      </div>

      <ScrollFade
        className="min-h-0 flex-1"
        viewportClassName="flex flex-col gap-4 px-1"
        fadeSize={16}
      >
        <div className="flex flex-col gap-4">
          <Textarea
            value={prompt}
            onChange={(event) => onPromptChange(event.target.value)}
            placeholder="Example: scout the codebase, plan the change, implement it, then review the diff"
            rows={5}
            readOnly={isWorking}
            aria-label="Describe the workflow"
          />
          <div
            className="flex flex-wrap items-center gap-2"
            aria-label="Example workflow descriptions"
          >
            <span className="text-2xs text-muted-foreground/60">Examples</span>
            {EXAMPLES.map((example) => (
              <button
                key={example.label}
                type="button"
                onClick={() => onExample(example.prompt)}
                disabled={isWorking}
                className="rounded-md px-2 py-1 text-left text-2xs text-muted-foreground/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)] motion-safe:transition-colors hover:bg-muted/40 hover:text-foreground disabled:pointer-events-none disabled:opacity-50"
              >
                {example.label}
              </button>
            ))}
          </div>
        </div>

        {isWorking ? (
          <div
            className="flex items-center gap-2 text-sm text-info"
            role="status"
            aria-live="polite"
          >
            <span className="h-2 w-2 rounded-full bg-info motion-safe:animate-pulse" />
            Working on your workflow
          </div>
        ) : null}

        {error !== null ? <p className="text-xs text-danger">{error}</p> : null}
        {providerReason !== null ? (
          <p className="text-xs text-muted-foreground">{providerReason}</p>
        ) : null}
      </ScrollFade>

      <div className="flex flex-wrap items-center justify-end gap-2">
        <Button variant="ghost" onClick={onBlank} disabled={isWorking}>
          Start blank
        </Button>
        <Button
          variant="primary"
          onClick={onCreate}
          disabled={isWorking || providerReason !== null || prompt.trim().length === 0}
        >
          <CONCEPT_ICONS.enhance size={14} aria-hidden />
          Create with agent
        </Button>
      </div>
    </div>
  </section>
);
