import type { WorkspaceId } from '@goodboy/types';
import { Switch } from '@goodboy/ui';
import { useOrchestratorModelPick } from '../../../hooks/useOrchestratorModelPick';
import { SettingRow } from '../../../../settings/settingRow';

type Props = {
  readonly workspaceId: WorkspaceId;
};

const HELP_OFF =
  'Off: the orchestrator says how hard each step is and Goodboy picks the model on your provider order.';

const HELP_ON =
  'On: the orchestrator also names the provider, model and effort of each step, from the models you can use.';

export const OrchestratorModelPickRow = ({ workspaceId }: Props) => {
  const { isOn, setIsOn } = useOrchestratorModelPick({ workspaceId });
  return (
    <SettingRow
      label="Models in workflows"
      rowKey="models-in-workflows"
      help={isOn ? HELP_ON : HELP_OFF}
    >
      <Switch
        ariaLabel="Let the workflow orchestrator choose models"
        checked={isOn}
        onChange={setIsOn}
      />
    </SettingRow>
  );
};
