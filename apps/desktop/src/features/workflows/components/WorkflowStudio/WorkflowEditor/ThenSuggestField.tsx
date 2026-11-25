import { useMemo } from 'react';
import { Listbox, type ListboxOption } from '@goodboy/ui';
import type { Workflow, WorkflowId } from '@goodboy/types';
import { WorkflowSection } from './WorkflowSection';

type Props = {
  readonly workflows: ReadonlyArray<Workflow>;
  readonly selfId: WorkflowId | null;
  readonly value: WorkflowId | null;
  readonly isDisabled: boolean;
  readonly onChange: (value: WorkflowId | null) => void;
};

const NOTHING = 'nothing';

export const ThenSuggestField = ({ workflows, selfId, value, isDisabled, onChange }: Props) => {
  const options = useMemo<ReadonlyArray<ListboxOption<string>>>(
    () => [
      { value: NOTHING, label: 'Nothing, just ask me' },
      ...workflows
        .filter((workflow) => workflow.id !== selfId && workflow.deletedAt == null)
        .map((workflow) => ({ value: workflow.id, label: workflow.name })),
    ],
    [selfId, workflows],
  );
  const isChosen = value !== null && options.some((option) => option.value === value);
  return (
    <WorkflowSection label="Then suggest" help="Another workflow to offer when this one stops.">
      <Listbox
        ariaLabel="Then suggest"
        size="md"
        isBlock
        searchable={false}
        value={isChosen ? value : NOTHING}
        options={options}
        disabled={isDisabled}
        onChange={(next) => {
          const match = workflows.find((workflow) => workflow.id === next);
          onChange(match === undefined ? null : match.id);
        }}
      />
    </WorkflowSection>
  );
};
