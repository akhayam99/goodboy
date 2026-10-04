import type { ReactNode } from 'react';
import { Eyebrow } from '@goodboy/ui';
import { PromptField } from '../../../../../shared/components/PromptField';
import { RuleDot } from './RuleDot';

type Props = {
  readonly guidance: string;
  readonly ruleSummary: string;
  readonly differs: boolean;
  readonly disabled: boolean;
  readonly tools: ReactNode;
  readonly recipients: ReactNode;
  readonly onGuidance: (guidance: string) => void;
};

const RUN_GUIDANCE_ID = 'workflow-run-guidance';

export const RunGuidanceField = ({
  guidance,
  ruleSummary,
  differs,
  disabled,
  tools,
  recipients,
  onGuidance,
}: Props) => (
  <section aria-label="Guidance" className="flex min-w-0 flex-col gap-2">
    <div className="flex items-center gap-2">
      <Eyebrow label="Guidance" muted />
      {differs ? <RuleDot ruleValue={ruleSummary} /> : null}
      <span className="text-meta text-faint-foreground">optional</span>
    </div>
    <PromptField
      kind="document"
      label="Run guidance"
      id={RUN_GUIDANCE_ID}
      value={guidance}
      onChange={onGuidance}
      placeholder="anything every agent that writes code should respect, one per line…"
      disabled={disabled}
      hasPreview
      minRows={2}
      maxRows={8}
    />
    {tools}
    {recipients}
  </section>
);
