import { useContext, useState } from 'react';
import type { WorkspaceId } from '@goodboy/types';
import { Band, Disclosure, Switch } from '@goodboy/ui';
import { useAppStore } from '../../../../store';
import { selectWorkspaceResolvedSettings } from '../../../../store/slices/overrides/selectResolvedSettings';
import { useWorkspaceOverrideSave } from '../../hooks/useWorkspaceOverrideSave';
import { SettingRowFocusContext } from '../../settingRowFocusContext';
import { WorkspaceFieldRow } from './WorkspaceFieldRow';

type Props = {
  readonly workspaceId: WorkspaceId;
};

const ADVANCED_ROWS: ReadonlySet<string> = new Set(['parallel-agents']);

export const RunsAdvancedBand = ({ workspaceId }: Props) => {
  const { row } = useContext(SettingRowFocusContext);
  const isTargeted = row !== null && ADVANCED_ROWS.has(row);
  const [isOpen, setIsOpen] = useState(isTargeted);
  const isParallelOn = useAppStore(
    (s) => selectWorkspaceResolvedSettings({ state: s, workspaceId }).parallelAgents,
  );
  const parallelSave = useWorkspaceOverrideSave({
    workspaceId,
    field: 'parallelAgents',
    saved: isParallelOn,
    patchOf: ({ value: isOn }) => ({ parallelAgents: isOn }),
  });

  const [wasTargeted, setWasTargeted] = useState(isTargeted);
  if (isTargeted !== wasTargeted) {
    setWasTargeted(isTargeted);
    if (isTargeted) {
      setIsOpen(true);
    }
  }

  return (
    <Disclosure
      testId="runs-advanced"
      label={<span className="text-row text-foreground">Advanced</span>}
      isOpen={isOpen}
      onToggle={() => setIsOpen((was) => !was)}
      actions={
        parallelSave.value ? (
          <span className="shrink-0 text-meta text-faint-foreground">Parallel agents on</span>
        ) : undefined
      }
    >
      <div className="flex min-w-0 flex-col pt-2">
        <Band inset="content" ariaLabel="Advanced">
          <WorkspaceFieldRow
            workspaceId={workspaceId}
            field="parallelAgents"
            help="Eligible agents split independent work, then merge one result."
          >
            <Switch
              ariaLabel="Parallel agents"
              checked={parallelSave.value}
              onChange={(isNext) => void parallelSave.save({ value: isNext })}
            />
          </WorkspaceFieldRow>
        </Band>
      </div>
    </Disclosure>
  );
};
