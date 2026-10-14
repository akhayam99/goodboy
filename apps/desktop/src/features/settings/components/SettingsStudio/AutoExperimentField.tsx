import { Chip, FieldRow, Switch } from '@goodboy/ui';
import { useAppStore } from '../../../../store';
import { tauriDatabase } from '../../../../shared/lib/db';
import { usePendingAction } from '../../../../shared/hooks/usePendingAction';
import { isAutoStartEnabled } from '../../../auto/isAutoStartEnabled';
import { useAutoExperimentValue } from '../../../auto/useAutoExperimentValue';
import { writeAutoExperiment } from '../../../auto/writeAutoExperiment';
import { SETTING_AUTO_EXPERIMENT } from '../../settings';

type Props = {
  readonly runningCount?: number;
};

const PENDING_KEY = 'auto-experiment';
const LABEL = 'Auto agent';
const HELP =
  'Start agents as Auto. It answers, or hands work to the roles it picks. It may not work well yet. Off keeps the roles you pick today.';

type RunningLineParams = {
  readonly count: number;
};

const runningLine = ({ count }: RunningLineParams): string =>
  count === 1
    ? '1 Auto agent is still running. It keeps going.'
    : `${count} Auto agents are still running. They keep going.`;

export const AutoExperimentField = ({ runningCount = 0 }: Props) => {
  const settings = useAutoExperimentValue();
  const isOn = isAutoStartEnabled({ settings, isReleased: true });
  const loadSetting = useAppStore((state) => state.loadSetting);
  const pending = usePendingAction();

  const onChange = (isNext: boolean): void => {
    void pending.run({
      key: PENDING_KEY,
      failureTitle: "Couldn't save the Auto setting",
      task: async () => {
        try {
          await writeAutoExperiment({ db: tauriDatabase, isOn: isNext });
        } finally {
          await loadSetting(SETTING_AUTO_EXPERIMENT);
        }
      },
    });
  };

  return (
    <FieldRow
      label={LABEL}
      marker={<Chip tone="warning" kind="state" shape="badge" label="Experimental" />}
      help={
        <span className="flex flex-col gap-1">
          <span>{HELP}</span>
          {!isOn && runningCount > 0 ? <span>{runningLine({ count: runningCount })}</span> : null}
        </span>
      }
    >
      <Switch ariaLabel={LABEL} checked={isOn} onChange={onChange} />
    </FieldRow>
  );
};
