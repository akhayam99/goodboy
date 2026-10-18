import { FieldRow, Switch } from '@goodboy/ui';
import { useClassifyRequests } from '../../../../../shared/hooks/useClassifyRequests';

const HELP_OFF = 'Off: Auto starts on the request exactly as you typed it.';

const HELP_ON =
  'On: before Auto starts, a small model (the Agent naming model) reads the request and starts a Scout, Planner, Debugger or Reviewer when it is sure. Otherwise Auto starts. A model you pinned for Auto is never overruled.';

export const ClassifyRequestsRow = () => {
  const { isOn, setIsOn } = useClassifyRequests();
  return (
    <FieldRow label="Typed requests" help={isOn ? HELP_ON : HELP_OFF}>
      <Switch ariaLabel="Let a small model read typed requests" checked={isOn} onChange={setIsOn} />
    </FieldRow>
  );
};
