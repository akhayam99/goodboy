import { Check, ChevronDown, X } from 'lucide-react';
import { AnchoredPopover, Button, Chip, cn, tintClasses, useDropdown } from '@goodboy/ui';
import type { ClaudePermissionMode, ProviderId, Session } from '@goodboy/types';
import { modeSupportFor } from '@goodboy/core';
import { useAppStore } from '../../../../store';
import { ICON_SIZE } from '../../../../shared/components/conceptIcons';
import { withShortcutHint } from '../../../../shared/keyboard/registry';
import { PROVIDER_LABEL } from '../../../providers/providerLabel';
import {
  DEFAULT_PERMISSION_MODE,
  MODE_COPY,
  PICKER_MODES,
  modeCopyOf,
  pickerModeOf,
} from '../../modeCopy';
import { openPermissionSettings } from '../../openPermissionSettings';

type Props = {
  readonly session: Session;
  readonly activeProvider: ProviderId;
};

export const PermissionModePicker = ({ session, activeProvider }: Props) => {
  const dropdown = useDropdown({
    width: 'w-80',
    expectedHeight: 300,
    openEvent: 'goodboy:open-permission-picker',
  });
  const { open, close, toggle } = dropdown;
  const setSessionPermissionMode = useAppStore((s) => s.setSessionPermissionMode);
  const workspaceDefault = useAppStore(
    (s) =>
      s.workspaces.find((workspace) => workspace.id === session.workspaceId)
        ?.defaultPermissionMode ?? DEFAULT_PERMISSION_MODE,
  );
  const current = modeCopyOf({ mode: session.permissionMode });
  const defaultCopy = modeCopyOf({ mode: workspaceDefault });
  const unavailableReason = (mode: ClaudePermissionMode): string | null => {
    const support = modeSupportFor({ provider: activeProvider, mode });
    if (support.support !== 'fallback' || support.reason === null) {
      return null;
    }
    return `Not available on ${PROVIDER_LABEL[activeProvider]}: ${support.reason}`;
  };
  const currentUnavailable = unavailableReason(session.permissionMode);
  const runsAs = modeSupportFor({ provider: activeProvider, mode: session.permissionMode }).runsAs;
  const triggerLabel =
    currentUnavailable === null
      ? current.promise
      : `${currentUnavailable}. Runs as ${modeCopyOf({ mode: runsAs }).label}`;
  const CurrentIcon = current.icon;

  const onPick = (mode: ClaudePermissionMode) => {
    void setSessionPermissionMode(session.id, mode);
    close();
  };

  return (
    <AnchoredPopover
      dropdown={dropdown}
      role="dialog"
      ariaLabel="Permission mode"
      className="rounded-lg border-0 bg-subtle py-1.5 ring-1 ring-border-soft"
      trigger={
        <Chip
          tone="neutral"
          bordered={false}
          size="md"
          as="button"
          onClick={toggle}
          title={withShortcutHint({
            label: triggerLabel,
            shortcut: 'session.permissions',
          })}
          hasPopup="dialog"
          expanded={open}
          className="gap-1.5 bg-subtle px-2.5 py-0.5 hover:bg-hover hover:opacity-100"
          icon={
            <CurrentIcon
              size={ICON_SIZE.row}
              aria-hidden
              className={tintClasses(current.tone).icon}
            />
          }
          label={<span className="text-foreground">{current.label}</span>}
          trailing={<ChevronDown size={11} aria-hidden className="text-faint-foreground" />}
        />
      }
    >
      <div className="flex items-center px-2.5 pb-1 pt-1">
        <span className="text-label text-muted-foreground">What can agents do?</span>
      </div>
      {PICKER_MODES.map((mode) => {
        const copy = MODE_COPY[mode];
        const Icon = copy.icon;
        const isActive = pickerModeOf({ mode: session.permissionMode }) === mode;
        const reason = unavailableReason(mode);
        const isUnavailable = reason !== null;
        return (
          <button
            key={mode}
            type="button"
            disabled={isUnavailable}
            onClick={() => onPick(mode)}
            className={cn(
              'flex w-full items-start gap-2 px-2.5 py-1.5 text-left motion-safe:transition-colors',
              isUnavailable ? 'cursor-not-allowed' : 'hover:bg-hover',
            )}
          >
            <Icon
              size={ICON_SIZE.control}
              aria-hidden
              className={cn(
                'mt-0.5 shrink-0',
                isUnavailable ? 'text-disabled-foreground' : tintClasses(copy.tone).icon,
              )}
            />
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="flex items-center gap-1.5">
                <span
                  className={cn(
                    'text-label',
                    isUnavailable ? 'text-disabled-foreground' : 'text-foreground',
                  )}
                >
                  {copy.label}
                </span>
                {defaultCopy.mode === mode ? (
                  <span className="rounded-sm bg-muted px-1 text-chip text-muted-foreground">
                    Default
                  </span>
                ) : null}
              </span>
              <span
                className={cn(
                  'text-secondary',
                  isUnavailable ? 'text-disabled-foreground' : 'text-muted-foreground',
                )}
              >
                {copy.promise}
              </span>
              {isUnavailable ? (
                <span className="flex items-center gap-1 text-secondary text-muted-foreground">
                  <X size={10} aria-hidden />
                  {reason}
                </span>
              ) : null}
            </span>
            {isActive ? (
              <Check
                size={ICON_SIZE.row}
                aria-label="Current mode"
                className="mt-0.5 shrink-0 text-primary"
              />
            ) : null}
          </button>
        );
      })}
      <div className="flex items-center gap-2 px-2.5 pt-1.5">
        <span className="min-w-0 flex-1 truncate text-secondary text-faint-foreground">
          Workspace default: {defaultCopy.label}
        </span>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            close();
            openPermissionSettings();
          }}
        >
          Rules
        </Button>
      </div>
    </AnchoredPopover>
  );
};
