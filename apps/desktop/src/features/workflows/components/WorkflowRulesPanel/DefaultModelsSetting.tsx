import { Button, useDropdown } from '@goodboy/ui';
import type { WorkspaceId } from '@goodboy/types';
import { NAMES } from '../../../../shared/utils/names';
import { MODELS_PAGE_SECTION } from '../../../settings/isModelsPage';
import { openSettings } from '../../../settings/openSettings';
import { usePolicySummary } from '../../hooks/usePolicySummary';
import { SettingChip } from '../../../../shared/components/SettingChip';

type Props = {
  readonly workspaceId: WorkspaceId;
};

const HELP = 'The providers a new run may use, and the backup when one is out.';

export const DefaultModelsSetting = ({ workspaceId }: Props) => {
  const dropdown = useDropdown({ expectedHeight: 200, expectedWidth: 320, width: 'w-80' });
  const summary = usePolicySummary({ workspaceId });
  return (
    <SettingChip
      dropdown={dropdown}
      label={NAMES.models}
      words={{
        value: summary,
        source: 'new runs',
        chain: `Set in ${NAMES.models}. A run can change its own from its page.`,
      }}
      help={HELP}
      error={null}
    >
      <p data-testid="rules-policy-summary" className="text-row text-foreground">
        {summary}
      </p>
      <Button
        variant="secondary"
        size="xs"
        className="self-start"
        onClick={() => {
          dropdown.close();
          openSettings({ scope: 'workspace', section: MODELS_PAGE_SECTION });
        }}
      >
        {`Open ${NAMES.models}`}
      </Button>
    </SettingChip>
  );
};
