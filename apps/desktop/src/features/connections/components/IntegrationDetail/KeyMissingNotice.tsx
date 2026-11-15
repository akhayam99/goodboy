import { Button, Notice } from '@goodboy/ui';
import type { WorkspaceId } from '@goodboy/types';
import type { KeyBinding } from '../../../../store/slices/integrations/verifyReplacementKey';
import { toolAccountOf } from '../../model/toolAccountOf';
import { ReplaceKeyForm } from './ReplaceKeyForm';

type Props = {
  readonly workspaceId: WorkspaceId;
  readonly binding: KeyBinding;
  readonly label: string;
  readonly isReplacing: boolean;
  readonly onReplace: () => void;
  readonly onReplaceDone: () => void;
};

export const KeyMissingNotice = ({
  workspaceId,
  binding,
  label,
  isReplacing,
  onReplace,
  onReplaceDone,
}: Props) => (
  <div className="flex min-w-0 flex-col gap-3">
    <Notice
      tone="danger"
      placement="inline"
      role="alert"
      title={`The ${label} key is missing from this Mac.`}
      body={`Every request to ${label} fails until a new key is saved.`}
      actions={
        isReplacing ? null : (
          <Button size="sm" onClick={onReplace}>
            Paste a new key
          </Button>
        )
      }
    />
    {isReplacing ? (
      <ReplaceKeyForm
        workspaceId={workspaceId}
        tool={binding.provider}
        label={label}
        keyKind={toolAccountOf({ binding }).keyKind}
        onSaved={onReplaceDone}
        onCancel={onReplaceDone}
      />
    ) : null}
  </div>
);
