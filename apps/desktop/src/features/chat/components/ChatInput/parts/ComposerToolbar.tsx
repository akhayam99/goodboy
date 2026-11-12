import type { ChangeEvent, RefObject } from 'react';
import { createPortal } from 'react-dom';
import type { Session } from '@goodboy/types';
import { PermissionModePicker } from '../../../../permissions/components/PermissionModePicker';
import { ATTACHMENT_ACCEPT } from '../../../attachment-kinds';
import { ATTACHMENT_LIMIT } from '../../../../attachments/pendingAttachment';
import { ComposerAttachmentCount } from '../../../../../shared/components/ComposerSurface/ComposerAttachmentCount';
import { ComposerFooter } from '../../../../../shared/components/ComposerSurface/ComposerFooter';
import type { ComposerControlSlots } from '../composerControlSlots';
import type { useTurnRouting } from '../hooks/useTurnRouting';
import { ComposerPlusMenu } from './ComposerPlusMenu';
import { ComposerRoutingPicker } from './ComposerRoutingPicker';
import { SendControl } from './SendControl';

type Props = {
  readonly session: Session;
  readonly routing: ReturnType<typeof useTurnRouting>;
  readonly isBlocked: boolean;
  readonly hasPermissionPicker: boolean;
  readonly controlSlots?: ComposerControlSlots;
  readonly attachmentCount: number;
  readonly fileInputRef: RefObject<HTMLInputElement | null>;
  readonly onFileInputChange: (event: ChangeEvent<HTMLInputElement>) => void;
  readonly onInsertPrefix: (symbol: string) => void;
  readonly isRunning: boolean;
  readonly canSend: boolean;
  readonly isDenying: boolean;
  readonly sendDisabledTitle: string | undefined;
  readonly onSend: () => void;
  readonly onSendNow: () => void;
};

export const ComposerToolbar = ({
  session,
  routing,
  isBlocked,
  hasPermissionPicker,
  controlSlots,
  attachmentCount,
  fileInputRef,
  onFileInputChange,
  onInsertPrefix,
  isRunning,
  canSend,
  isDenying,
  sendDisabledTitle,
  onSend,
  onSendNow,
}: Props) => {
  const asks = hasPermissionPicker ? (
    <PermissionModePicker session={session} activeProvider={routing.effectiveProvider} />
  ) : null;
  const isInline = controlSlots === undefined;
  return (
    <div data-composer-toolbar="" className="@container min-w-0">
      <ComposerFooter
        start={
          <>
            <ComposerPlusMenu
              disabled={isBlocked}
              onAttachFiles={() => fileInputRef.current?.click()}
              onInsertPrefix={onInsertPrefix}
            />
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
            {isInline ? asks : null}
            <ComposerAttachmentCount
              count={attachmentCount}
              limit={ATTACHMENT_LIMIT}
              noun="files"
            />
          </>
        }
        end={
          <>
            <ComposerRoutingPicker routing={routing} />
            <SendControl
              isRunning={isRunning}
              canSend={canSend}
              isDenying={isDenying}
              sendDisabledTitle={sendDisabledTitle}
              onSend={onSend}
              onSendNow={onSendNow}
            />
          </>
        }
      />
      {controlSlots === undefined || controlSlots.asks === null || asks === null
        ? null
        : createPortal(asks, controlSlots.asks)}
    </div>
  );
};
