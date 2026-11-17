import { Switch } from '@goodboy/ui';
import { useClassifyRequests } from '../../../../../shared/hooks/useClassifyRequests';
import { SettingRow } from '../../../../settings/settingRow';

const HELP_OFF = 'Off: the Lead starts on the request exactly as you typed it.';

const HELP_ON =
  'On: before the Lead starts, a small model (the Agent naming model) reads the request and starts a Scout, Planner, Debugger or Reviewer when it is sure. Otherwise the Lead starts. A model you pinned for the Lead is never overruled.';

export const ClassifyRequestsRow = () => {
  const { isOn, setIsOn } = useClassifyRequests();
  return (
    <SettingRow label="Typed requests" rowKey="typed-requests" help={isOn ? HELP_ON : HELP_OFF}>
      <Switch ariaLabel="Let a small model read typed requests" checked={isOn} onChange={setIsOn} />
    </SettingRow>
  );
};
