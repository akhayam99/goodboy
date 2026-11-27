import { Button } from '@goodboy/ui';
import { CONCEPT_ICONS } from '../../../shared/components/conceptIcons';
import { openSettings } from '../../settings/openSettings';
import { HOME_WIDGETS, type WidgetSize } from '../grid/homeWidgets';
import type { HomeFacts } from '../hooks/useHomeFacts';
import { useHomeSettings } from '../hooks/useHomeSettings';
import { setupDiffOf } from '../reads/setupDiffOf';
import { EmptyLine } from '../WidgetCard/EmptyLine';
import { FactRow } from '../WidgetCard/FactRow';
import { HeroNumber } from '../WidgetCard/HeroNumber';
import { MoreLink } from '../WidgetCard/MoreLink';
import { WidgetCard } from '../WidgetCard';
import { WidgetSkeleton } from '../WidgetCard/WidgetSkeleton';

type Props = {
  readonly facts: HomeFacts;
  readonly size: WidgetSize;
};

const SHOWN_IN_MEDIUM = 3;

const openWorkspaceSettings = (): void => openSettings({ scope: 'workspace' });

export const WorkspaceSetup = ({ facts, size }: Props) => {
  const snapshot = useHomeSettings({ workspaceId: facts.workspaceId });
  const rows = setupDiffOf({ snapshot });
  const extra = Math.max(0, rows.length - SHOWN_IN_MEDIUM);
  return (
    <WidgetCard
      id="workspaceSetup"
      title={HOME_WIDGETS.workspaceSetup.title}
      icon={CONCEPT_ICONS.workspace}
      count={facts.isLoading ? 0 : rows.length}
      footer={
        size === 'M' ? (
          extra > 0 ? (
            <MoreLink count={extra} onOpen={openWorkspaceSettings} />
          ) : (
            <Button size="xs" variant="quiet" onClick={openWorkspaceSettings}>
              Open settings
            </Button>
          )
        ) : undefined
      }
    >
      {facts.isLoading ? (
        <WidgetSkeleton label="Loading workspace setup" />
      ) : rows.length === 0 ? (
        <EmptyLine text="Nothing differs from the defaults." />
      ) : size === 'S' ? (
        <div className="flex min-w-0 flex-1 flex-col justify-center">
          <HeroNumber value={String(rows.length)} unit="changed" />
        </div>
      ) : (
        <ul className="flex min-w-0 flex-1 flex-col">
          {rows.slice(0, SHOWN_IN_MEDIUM).map((row) => (
            <FactRow key={row.id} label={row.label} value={row.value} />
          ))}
        </ul>
      )}
    </WidgetCard>
  );
};
