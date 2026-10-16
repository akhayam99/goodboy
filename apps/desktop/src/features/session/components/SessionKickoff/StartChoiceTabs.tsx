import { SegmentedTabs, type SegmentedTabOption } from '@goodboy/ui';
import { CONCEPT_ICONS } from '../../../../shared/components/conceptIcons';
import {
  ASK_AGENT_CHOICE,
  ORCHESTRATE_CHOICE,
  RUN_WORKFLOW_CHOICE,
  TASK_CHOICE,
} from '../../../../shared/lib/startCopy';
import { START_CHOICES, type StartChoice } from './startChoice';

type ChoiceOption = {
  readonly title: string;
  readonly icon: (typeof CONCEPT_ICONS)[keyof typeof CONCEPT_ICONS];
};

const START_OPTIONS: Readonly<Record<StartChoice, ChoiceOption>> = {
  task: { title: TASK_CHOICE, icon: CONCEPT_ICONS.issues },
  workflow: { title: RUN_WORKFLOW_CHOICE, icon: CONCEPT_ICONS.workflows },
  orchestrate: { title: ORCHESTRATE_CHOICE, icon: CONCEPT_ICONS.orchestrator },
  scout: { title: ASK_AGENT_CHOICE, icon: CONCEPT_ICONS.agents },
};

type Props = {
  readonly ariaLabel: string;
  readonly value: StartChoice;
  readonly onChange: (choice: StartChoice) => void;
};

export const StartChoiceTabs = ({ ariaLabel, value, onChange }: Props) => {
  const options: ReadonlyArray<SegmentedTabOption<StartChoice>> = START_CHOICES.map((choice) => ({
    value: choice,
    label: START_OPTIONS[choice].title,
    icon: START_OPTIONS[choice].icon,
  }));

  return (
    <SegmentedTabs
      ariaLabel={ariaLabel}
      options={options}
      value={value}
      onChange={onChange}
      className="self-start"
    />
  );
};
