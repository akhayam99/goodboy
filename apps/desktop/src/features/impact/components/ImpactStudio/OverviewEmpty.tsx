import { Button, EmptyState, formatUsd } from '@goodboy/ui';
import { CONCEPT_ICONS, CONCEPT_TONE } from '../../../../shared/components/conceptIcons';
import { useCurrentWorkspace, useSessions, useWorkspaceRollup } from '../../../../store';
import { overviewEmptyTitle } from './overviewEmptyTitle';

type Props = {
  readonly onStartSession: () => void;
};

export const OverviewEmpty = ({ onStartSession }: Props) => {
  const workspace = useCurrentWorkspace();
  const sessions = useSessions();
  const rollup = useWorkspaceRollup(workspace?.id ?? null, sessions);

  return (
    <EmptyState
      icon={CONCEPT_ICONS.impact}
      tone={CONCEPT_TONE.impact}
      title={overviewEmptyTitle({
        todaySpend: rollup.todaySpend,
        spentLabel: formatUsd(rollup.todaySpend),
      })}
      action={
        <Button variant="secondary" size="sm" onClick={onStartSession}>
          Start a session
        </Button>
      }
      bordered
      size="page"
      headingLevel={2}
    />
  );
};
