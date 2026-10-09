import { SegmentedTabs, type SegmentedTabOption } from '@goodboy/ui';
import { CONCEPT_ICONS } from '../../../../shared/components/conceptIcons';
import { WORKFLOW_CHOICE_LINE } from '../../../../shared/lib/startCopy';
import { START_CHOICES, type StartChoice } from './startChoice';

type ChoiceOption = {
  readonly title: string;
  readonly line: string;
  readonly icon: (typeof CONCEPT_ICONS)[keyof typeof CONCEPT_ICONS];
};

const START_OPTIONS: Readonly<Record<StartChoice, ChoiceOption>> = {
  task: {
    title: 'Pick up a task',
    line: 'An issue from your tracker.',
    icon: CONCEPT_ICONS.issues,
  },
  workflow: {
    title: 'Run a workflow',
    line: WORKFLOW_CHOICE_LINE,
    icon: CONCEPT_ICONS.workflows,
  },
  scout: {
    title: 'Ask an agent',
    line: 'Scout or any other role.',
    icon: CONCEPT_ICONS.explore,
  },
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
    hint: START_OPTIONS[choice].line,
    icon: START_OPTIONS[choice].icon,
  }));

  return (
    <SegmentedTabs
      variant="card"
      ariaLabel={ariaLabel}
      options={options}
      value={value}
      onChange={onChange}
    />
  );
};
