import { useEffect, useState } from 'react';
import type { WorkspaceId } from '@goodboy/types';
import { FieldRow, SegmentedTabs, type SegmentedTabOption } from '@goodboy/ui';
import { useAppStore } from '../../../../store';
import { changeRunDefault } from '../../../session/startRun/changeRunDefault';
import {
  parseRunDefault,
  runDefaultKey,
  type RunDefault,
} from '../../../session/startRun/runDefaultSetting';
import { RUN_ROUTE_COPY } from '../../../session/startRun/runRouteCopy';

type Props = {
  readonly workspaceId: WorkspaceId;
};

const RUN_DEFAULT_OPTIONS: ReadonlyArray<SegmentedTabOption<RunDefault>> = [
  { value: 'auto', label: RUN_ROUTE_COPY.defaults.auto },
  { value: 'plan', label: RUN_ROUTE_COPY.defaults.plan },
  { value: 'lead', label: RUN_ROUTE_COPY.defaults.lead },
];

const DISABLED_OPTIONS: ReadonlyArray<SegmentedTabOption<RunDefault>> = RUN_DEFAULT_OPTIONS.map(
  (option) => ({ ...option, disabled: true }),
);

export const RunDefaultField = ({ workspaceId }: Props) => {
  const key = runDefaultKey({ scope: { kind: 'workspace', workspaceId } });
  const raw = useAppStore((state) => state.settings[key]);
  const loadSetting = useAppStore((state) => state.loadSetting);
  const reportError = useAppStore((state) => state.reportError);
  const [isSaving, setIsSaving] = useState(false);
  const value = parseRunDefault({ raw }) ?? 'auto';

  useEffect(() => {
    loadSetting(key).catch((error: unknown) => {
      void reportError({ title: "Couldn't read how new runs start", error, workspaceId });
    });
  }, [key, loadSetting, reportError, workspaceId]);

  const save = async (shape: RunDefault): Promise<void> => {
    setIsSaving(true);
    try {
      await changeRunDefault({ scope: { kind: 'workspace', workspaceId }, shape });
    } catch (error) {
      void reportError({ title: "Couldn't save how new runs start", error, workspaceId });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <FieldRow label={RUN_ROUTE_COPY.workspaceDefault} help={RUN_ROUTE_COPY.workspaceDefaultHelp}>
      <SegmentedTabs
        ariaLabel={RUN_ROUTE_COPY.workspaceDefault}
        size="sm"
        value={value}
        options={isSaving ? DISABLED_OPTIONS : RUN_DEFAULT_OPTIONS}
        onChange={(shape) => void save(shape)}
      />
    </FieldRow>
  );
};
