import { Button } from '@goodboy/ui';
import { CONCEPT_ICONS } from '../../../shared/components/conceptIcons';
import { openRunDefaults } from '../../settings/openRunDefaults';
import { HOME_WIDGETS, type WidgetSize } from '../grid/homeWidgets';
import type { HomeFacts } from '../hooks/useHomeFacts';
import { useHomeSettings } from '../hooks/useHomeSettings';
import { workflowRulesOf } from '../reads/workflowRulesOf';
import { EmptyLine } from '../WidgetCard/EmptyLine';
import { FactRow } from '../WidgetCard/FactRow';
import { HeroNumber } from '../WidgetCard/HeroNumber';
import { MoreLink } from '../WidgetCard/MoreLink';
import { WidgetCard } from '../WidgetCard';
import { WidgetSkeleton } from '../WidgetCard/WidgetSkeleton';
import { rowsFor } from '../WidgetCard/rowsFor';

type Props = {
  readonly facts: HomeFacts;
  readonly size: WidgetSize;
};

const SHOWN_IN_MEDIUM = 3;

export const WorkflowRules = ({ facts, size }: Props) => {
  const snapshot = useHomeSettings({ workspaceId: facts.workspaceId });
  const rows = workflowRulesOf({ snapshot });
  const shown = size === 'M' ? SHOWN_IN_MEDIUM : rowsFor({ size });
  const extra = Math.max(0, rows.length - shown);
  return (
    <WidgetCard
      id="workflowRules"
      title={HOME_WIDGETS.workflowRules.title}
      icon={CONCEPT_ICONS.workflows}
      count={facts.isLoading ? 0 : rows.length}
      footer={extra > 0 ? <MoreLink count={extra} onOpen={openRunDefaults} /> : undefined}
    >
      {facts.isLoading ? (
        <WidgetSkeleton label="Loading rules" />
      ) : rows.length === 0 ? (
        <EmptyLine
          text="No rules on. Defaults apply."
          action={
            size === 'S' ? undefined : (
              <Button size="xs" variant="quiet" onClick={openRunDefaults}>
                Open Every run
              </Button>
            )
          }
        />
      ) : size === 'S' ? (
        <div className="flex min-w-0 flex-1 flex-col justify-center">
          <HeroNumber value={String(rows.length)} unit="on" />
        </div>
      ) : (
        <ul className="flex min-w-0 flex-1 flex-col">
          {rows.slice(0, shown).map((row) => (
            <FactRow key={row.id} label={row.label} value={row.value} />
          ))}
        </ul>
      )}
    </WidgetCard>
  );
};
