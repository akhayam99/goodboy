import type { ChangeEvent, RefObject } from 'react';
import type { Session } from '@goodboy/types';
import { PermissionModePicker } from '../../../../permissions/components/PermissionModePicker';
import { ATTACHMENT_ACCEPT } from '../../../attachment-kinds';
import type { useTurnRouting } from '../hooks/useTurnRouting';
import { ComposerPlusMenu } from './ComposerPlusMenu';
import { ComposerRoutingPicker } from './ComposerRoutingPicker';
import { SendControl } from './SendControl';

type Props = {
  readonly session: Session;
  readonly routing: ReturnType<typeof useTurnRouting>;
  readonly isBlocked: boolean;
  readonly attachmentCount: number;
  readonly fileInputRef: RefObject<HTMLInputElement | null>;
  readonly onFileInputChange: (event: ChangeEvent<HTMLInputElement>) => void;
  readonly onInsertPrefix: (symbol: string) => void;
  readonly isRunning: boolean;
  readonly isEmpty: boolean;
  readonly canSend: boolean;
  readonly showsDeliveryChoice: boolean;
  readonly sendDisabledTitle: string | undefined;
  readonly onCancel: () => void;
  readonly onSend: () => void;
  readonly onSendNow: () => void;
};

export const ComposerToolbar = ({
  session,
  routing,
  isBlocked,
  attachmentCount,
  fileInputRef,
  onFileInputChange,
  onInsertPrefix,
  isRunning,
  isEmpty,
  canSend,
  showsDeliveryChoice,
  sendDisabledTitle,
  onCancel,
  onSend,
  onSendNow,
}: Props) => (
  <div className="flex h-8 items-center justify-between gap-2 px-2.5 pb-1.5">
    <div className="flex items-center gap-2">
      <ComposerPlusMenu
        disabled={isBlocked}
        onAttachFiles={() => fileInputRef.current?.click()}
        onInsertPrefix={onInsertPrefix}
      />
      <PermissionModePicker session={session} activeProvider={routing.effectiveProvider} />
      {attachmentCount > 0 && (
        <span className="text-secondary text-faint-foreground">
          {attachmentCount} {attachmentCount === 1 ? 'file' : 'files'}
        </span>
      )}
    </div>
    <input
      ref={fileInputRef}
      type="file"
      accept={ATTACHMENT_ACCEPT}
      multiple
      aria-label="Attach files"
      tabIndex={-1}
      className="hidden"
      onChange={onFileInputChange}
    />
    <div className="flex items-center gap-2">
      <ComposerRoutingPicker routing={routing} />
      <SendControl
        isRunning={isRunning}
        isEmpty={isEmpty}
        canSend={canSend}
        showsDeliveryChoice={showsDeliveryChoice}
        sendDisabledTitle={sendDisabledTitle}
        onCancel={onCancel}
        onSend={onSend}
        onSendNow={onSendNow}
      />
    </div>
  </div>
);
