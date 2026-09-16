import { useId } from 'react';
import { SectionHeader, Select } from '@goodboy/ui';
import type { WorkflowRunId } from '@goodboy/types';
import type { ArtifactBasedOn } from '../../../../store/slices/artifactDrafts/types';

export type ArtifactRunOption = Readonly<{
  workflowRunId: WorkflowRunId;
  label: string;
}>;

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
        <Select
          id={fieldId}
          size="sm"
          block
          data-testid="artifact-based-on"
          value={value.kind === 'workflow-run' ? value.workflowRunId : ''}
          onChange={(event) => {
            const next = event.target.value;
            onChange(
              next === ''
                ? { kind: 'session' }
                : { kind: 'workflow-run', workflowRunId: next as WorkflowRunId },
            );
          }}
        >
          <option value="">This session</option>
          {runs.map((run) => (
            <option key={run.workflowRunId} value={run.workflowRunId}>
              {run.label}
            </option>
          ))}
        </Select>
        <span className="text-2xs leading-relaxed text-muted-foreground">{scopeLine}</span>
        <span className="text-2xs leading-relaxed text-muted-foreground">{repoLine}</span>
      </div>
    </section>
  );
};
