import { SegmentedTabs } from '@goodboy/ui';

export type StudioHomeView = 'workflows' | 'steps';

type Props = {
  readonly value: StudioHomeView;
  readonly workflowCount: number;
  readonly stepCount: number;
  readonly onChange: (view: StudioHomeView) => void;
};

export const StudioHomeTabs = ({ value, workflowCount, stepCount, onChange }: Props) => (
  <SegmentedTabs
    ariaLabel="Workflows and saved steps"
    size="sm"
    className="w-max shrink-0"
    value={value}
    onChange={onChange}
    options={[
      {
        value: 'workflows',
        label: 'Workflows',
        ...(workflowCount > 0 && { badge: workflowCount }),
      },
      { value: 'steps', label: 'Saved steps', ...(stepCount > 0 && { badge: stepCount }) },
    ]}
  />
);
