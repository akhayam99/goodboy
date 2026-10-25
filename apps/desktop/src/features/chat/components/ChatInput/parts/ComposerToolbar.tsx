import type { ChangeEvent, RefObject } from 'react';
import { createPortal } from 'react-dom';
import type { Session } from '@goodboy/types';
import { PermissionModePicker } from '../../../../permissions/components/PermissionModePicker';
import { ATTACHMENT_ACCEPT } from '../../../attachment-kinds';
import type { ComposerControlSlots } from '../composerControlSlots';
import type { useTurnRouting } from '../hooks/useTurnRouting';
import type { StopPhase } from '../../../../../shared/hooks/useAgentStop';
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
  readonly sendDisabledTitle: string | undefined;
  readonly onSend: () => void;
  readonly onSendNow: () => void;
  readonly stopPhase: StopPhase;
  readonly isStopArmed: boolean;
  readonly onStop: () => void;
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
  sendDisabledTitle,
  onSend,
  onSendNow,
  stopPhase,
  isStopArmed,
  onStop,
}: Props) => {
  const asks = hasPermissionPicker ? (
    <PermissionModePicker session={session} activeProvider={routing.effectiveProvider} />
  ) : null;
  const models = <ComposerRoutingPicker routing={routing} />;
  const isInline = controlSlots === undefined;
  return (
    <div data-composer-toolbar="" className="@container min-w-0">
      <div className="flex h-8 min-w-0 items-center justify-between gap-2 px-3 pb-2">
        <div className="flex shrink-0 items-center gap-2">
          <ComposerPlusMenu
            disabled={isBlocked}
            onAttachFiles={() => fileInputRef.current?.click()}
            onInsertPrefix={onInsertPrefix}
          />
          {isInline ? asks : null}
          {attachmentCount > 0 && (
            <span className="whitespace-nowrap text-meta text-faint-foreground">
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
        <div className="flex min-w-0 items-center gap-2">
          {isInline ? models : null}
          <SendControl
            isRunning={isRunning}
            canSend={canSend}
            sendDisabledTitle={sendDisabledTitle}
            onSend={onSend}
            onSendNow={onSendNow}
            stopPhase={stopPhase}
            isStopArmed={isStopArmed}
            onStop={onStop}
          />
        </div>
      </div>
      {controlSlots === undefined || controlSlots.asks === null || asks === null
        ? null
        : createPortal(asks, controlSlots.asks)}
      {controlSlots === undefined || controlSlots.models === null
        ? null
        : createPortal(models, controlSlots.models)}
    </div>
  );
};
