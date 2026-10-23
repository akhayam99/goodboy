import { useEffect, useState } from 'react';
import { FieldRow, SegmentedTabs, type SegmentedTabOption } from '@goodboy/ui';
import { useAppStore } from '../../../../store';
import { changeRunDefault } from '../../../session/startRun/changeRunDefault';
import {
  parseRunDefault,
  runDefaultKey,
  type RunDefault,
  type RunDefaultScope,
} from '../../../session/startRun/runDefaultSetting';
import { RUN_ROUTE_COPY } from '../../../session/startRun/runRouteCopy';

type Props = {
  readonly scope: RunDefaultScope;
  readonly label: string;
  readonly help: string;
  readonly fallback: RunDefault | null;
};

type SaveParams = {
  readonly shape: RunDefault;
};

const RUN_DEFAULT_OPTIONS: ReadonlyArray<SegmentedTabOption<RunDefault>> = [
  { value: 'auto', label: RUN_ROUTE_COPY.defaults.auto },
  { value: 'plan', label: RUN_ROUTE_COPY.defaults.plan },
  { value: 'lead', label: RUN_ROUTE_COPY.defaults.lead },
];

const DISABLED_OPTIONS: ReadonlyArray<SegmentedTabOption<RunDefault>> = RUN_DEFAULT_OPTIONS.map(
  (option) => ({ ...option, disabled: true }),
);

export const RunDefaultRow = ({ scope, label, help, fallback }: Props) => {
  const key = runDefaultKey({ scope });
  const raw = useAppStore((state) => state.settings[key]);
  const loadSetting = useAppStore((state) => state.loadSetting);
  const reportError = useAppStore((state) => state.reportError);
  const [isSaving, setIsSaving] = useState(false);
  const value = parseRunDefault({ raw }) ?? fallback;

  useEffect(() => {
    loadSetting(key).catch((error: unknown) => {
      void reportError({ title: "Couldn't read how new runs start", error });
    });
  }, [key, loadSetting, reportError]);

  const save = async ({ shape }: SaveParams): Promise<void> => {
    setIsSaving(true);
    try {
      await changeRunDefault({ scope, shape });
    } catch (error) {
      void reportError({ title: "Couldn't save how new runs start", error });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <FieldRow label={label} help={help}>
      <SegmentedTabs
        ariaLabel={label}
        size="sm"
        value={value}
        options={isSaving ? DISABLED_OPTIONS : RUN_DEFAULT_OPTIONS}
        onChange={(shape) => void save({ shape })}
      />
    </FieldRow>
  );
};
