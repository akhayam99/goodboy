import { useId } from 'react';
import { Listbox, SectionHeader } from '@goodboy/ui';
import type { WorkflowRunId } from '@goodboy/types';
import type { ArtifactBasedOn } from '../../../../store/slices/artifactDrafts/types';

export type ArtifactRunOption = Readonly<{
  workflowRunId: WorkflowRunId;
  label: string;
}>;

const SESSION_VALUE = '';

type Props = {
  readonly runs: ReadonlyArray<ArtifactRunOption>;
  readonly value: ArtifactBasedOn;
  readonly scopeLine: string;
  readonly repoLine: string;
  readonly onChange: (value: ArtifactBasedOn) => void;
};

export const ArtifactBasedOnField = ({ runs, value, scopeLine, repoLine, onChange }: Props) => {
  const fieldId = useId();

  return (
    <section className="flex min-w-0 flex-col gap-2">
      <SectionHeader label="Based on" htmlFor={fieldId} />
      <div className="flex min-w-0 flex-col gap-1.5">
        <Listbox
          id={fieldId}
          size="sm"
          isBlock
          testId="artifact-based-on"
          value={value.kind === 'workflow-run' ? value.workflowRunId : SESSION_VALUE}
          options={[
            { value: SESSION_VALUE, label: 'This session' },
            ...runs.map((run) => ({ value: run.workflowRunId, label: run.label })),
          ]}
          onChange={(next) => {
            const run = runs.find((candidate) => candidate.workflowRunId === next);
            onChange(
              run === undefined
                ? { kind: 'session' }
                : { kind: 'workflow-run', workflowRunId: run.workflowRunId },
            );
          }}
        />
        <span className="text-2xs leading-relaxed text-muted-foreground">{scopeLine}</span>
        <span className="text-2xs leading-relaxed text-muted-foreground">{repoLine}</span>
      </div>
    </section>
  );
};
