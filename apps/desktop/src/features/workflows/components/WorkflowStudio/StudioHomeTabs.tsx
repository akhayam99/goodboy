import { PageTabs } from '@goodboy/ui';
import type { StudioHomeView } from '../../studioHomeView';

type Props = {
  readonly value: StudioHomeView;
  readonly workflowCount: number;
  readonly stepCount: number;
  readonly onChange: (view: StudioHomeView) => void;
};

export const StudioHomeTabs = ({ value, workflowCount, stepCount, onChange }: Props) => (
  <PageTabs
    ariaLabel="Workflows, every run and saved steps"
    value={value}
    onChange={onChange}
    options={[
      { value: 'workflows', label: 'Workflows', badge: workflowCount },
      { value: 'every', label: 'Every run' },
      { value: 'steps', label: 'Saved steps', badge: stepCount },
    ]}
  />
);
