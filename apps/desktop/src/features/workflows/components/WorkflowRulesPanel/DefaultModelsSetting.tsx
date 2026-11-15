import { Button, FieldRow } from '@goodboy/ui';
import type { WorkspaceId } from '@goodboy/types';
import { NAMES } from '../../../../shared/utils/names';
import { openSettings } from '../../../settings/openSettings';
import { usePolicySummary } from '../../hooks/usePolicySummary';

type Props = {
  readonly workspaceId: WorkspaceId;
};

const HELP = 'The providers a new run may use, and the backup when one is out.';

export const DefaultModelsSetting = ({ workspaceId }: Props) => {
  const summary = usePolicySummary({ workspaceId });
  return (
    <FieldRow label={NAMES.models} help={HELP}>
      <div className="flex min-w-0 items-center gap-2">
        <span data-testid="rules-policy-summary" className="truncate text-row text-foreground">
          {summary}
        </span>
        <Button variant="secondary" size="xs" onClick={() => openSettings({ scope: 'providers' })}>
          {`Open ${NAMES.models}`}
        </Button>
      </div>
    </FieldRow>
  );
};
