import { Button } from '@goodboy/ui';
import type { WorkspaceId } from '@goodboy/types';
import { SettingRow } from '../../../settings/settingRow';
import { NAMES } from '../../../../shared/utils/names';
import { MODELS_PAGE_SECTION } from '../../../settings/isModelsPage';
import { openSettings } from '../../../settings/openSettings';
import { usePolicySummary } from '../../hooks/usePolicySummary';

type Props = {
  readonly workspaceId: WorkspaceId;
};

const HELP = 'The providers a new run may use, and the backup when one is out.';

export const DefaultModelsSetting = ({ workspaceId }: Props) => {
  const summary = usePolicySummary({ workspaceId });
  return (
    <SettingRow label={NAMES.models} rowKey="run-models" help={HELP}>
      <div className="flex min-w-0 items-center gap-2">
        <span data-testid="rules-policy-summary" className="truncate text-row text-foreground">
          {summary}
        </span>
        <Button
          variant="secondary"
          size="xs"
          onClick={() => openSettings({ scope: 'workspace', section: MODELS_PAGE_SECTION })}
        >
          {`Open ${NAMES.models}`}
        </Button>
      </div>
    </SettingRow>
  );
};
