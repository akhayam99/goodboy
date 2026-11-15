import { Band, Button } from '@goodboy/ui';
import type { WorkspaceId } from '@goodboy/types';
import type { KeyBinding } from '../../../../store/slices/integrations/verifyReplacementKey';
import { toolAccountOf } from '../../model/toolAccountOf';
import type { ToolState } from '../../model/toolStateOf';
import { AccountRow } from './AccountRow';
import { ReplaceKeyForm } from './ReplaceKeyForm';
import { ToolSection } from './ToolSection';

type Props = {
  readonly workspaceId: WorkspaceId;
  readonly binding: KeyBinding;
  readonly label: string;
  readonly toolState: ToolState;
  readonly isReplacing: boolean;
  readonly onReplace: () => void;
  readonly onReplaceDone: () => void;
};

export const AccountSection = ({
  workspaceId,
  binding,
  label,
  toolState,
  isReplacing,
  onReplace,
  onReplaceDone,
}: Props) => {
  const account = toolAccountOf({ binding });
  const isKeyMissing = toolState.kind === 'keyMissing';
  const isFormHere = isReplacing && !isKeyMissing;

  return (
    <ToolSection label="Account">
      <Band>
        <AccountRow label="Connected as" primary={account.who} secondary={account.where} />
        <AccountRow
          label="Key"
          primary={account.keyKind}
          secondary={
            isKeyMissing ? (
              <span className="text-danger">Missing from this Mac&apos;s keychain</span>
            ) : (
              "In your Mac's keychain"
            )
          }
          action={
            isReplacing || isKeyMissing ? null : (
              <Button size="sm" variant="quiet" onClick={onReplace}>
                Replace key
              </Button>
            )
          }
        />
        {isFormHere ? (
          <div className="px-2 pb-2">
            <ReplaceKeyForm
              workspaceId={workspaceId}
              tool={binding.provider}
              label={label}
              keyKind={account.keyKind}
              onSaved={onReplaceDone}
              onCancel={onReplaceDone}
            />
          </div>
        ) : null}
      </Band>
    </ToolSection>
  );
};
