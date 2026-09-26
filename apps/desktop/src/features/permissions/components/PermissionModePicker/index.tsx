import { ChevronDown } from 'lucide-react';
import { AnchoredPopover, Chip, cn, StatusDot, type Tone, useDropdown, Eyebrow } from '@goodboy/ui';
import type { ClaudePermissionMode, ProviderId, Session } from '@goodboy/types';
import { modeSupportFor } from '@goodboy/core';
import { useAppStore } from '../../../../store';
import { withShortcutHint } from '../../../../shared/keyboard/registry';
import { PROVIDER_LABEL } from '../../../providers/providerLabel';

type ModeMeta = {
  readonly value: ClaudePermissionMode;
  readonly label: string;
  readonly description: string;
  readonly tone: Tone;
  readonly text: string;
};

const PERMISSION_MODE_META: Record<ClaudePermissionMode, ModeMeta> = {
  bypassPermissions: {
    value: 'bypassPermissions',
    label: 'Bypass',
    description: 'Agent uses all tools freely, no prompts',
    tone: 'danger',
    text: 'text-danger',
  },
  acceptEdits: {
    value: 'acceptEdits',
    label: 'Edits',
    description: 'File edits allowed, asks before bash',
    tone: 'warning',
    text: 'text-warning',
  },
  default: {
    value: 'default',
    label: 'Default',
    description: 'Asks before writes and runs',
    tone: 'info',
    text: 'text-info',
  },
  dontAsk: {
    value: 'dontAsk',
    label: "Don't ask",
    description: 'Requests that need approval are denied, no prompts',
    tone: 'neutral',
    text: 'text-muted-foreground',
  },
  plan: {
    value: 'plan',
    label: 'Plan',
    description: 'No tool calls executed, read-only',
    tone: 'neutral',
    text: 'text-muted-foreground',
  },
};

const PERMISSION_MODES: ReadonlyArray<ModeMeta> = [
  PERMISSION_MODE_META.bypassPermissions,
  PERMISSION_MODE_META.acceptEdits,
  PERMISSION_MODE_META.default,
  PERMISSION_MODE_META.dontAsk,
  PERMISSION_MODE_META.plan,
];

export const permissionModeMeta = (mode: ClaudePermissionMode): ModeMeta => {
  return PERMISSION_MODE_META[mode] ?? PERMISSION_MODE_META.plan;
};

type Props = {
  readonly session: Session;
  readonly activeProvider: ProviderId;
};

export const PermissionModePicker = ({ session, activeProvider }: Props) => {
  const dropdown = useDropdown({
    width: 'w-64',
    expectedHeight: 280,
    openEvent: 'goodboy:open-permission-picker',
  });
  const { open, close, toggle } = dropdown;
  const setSessionPermissionMode = useAppStore((s) => s.setSessionPermissionMode);
  const current = permissionModeMeta(session.permissionMode);
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
      ? current.description
      : `${currentUnavailable}. Runs as ${permissionModeMeta(runsAs).label}`;

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
          icon={<StatusDot tone={current.tone} size="sm" />}
          label={<span className={cn(current.text)}>{current.label}</span>}
          trailing={<ChevronDown size={11} aria-hidden className="text-faint-foreground" />}
        />
      }
    >
      <div className="flex items-center px-2.5 pb-0.5 pt-1">
        <Eyebrow label="Permission mode" muted />
      </div>
      {PERMISSION_MODES.map((m) => {
        const active = session.permissionMode === m.value;
        const reason = unavailableReason(m.value);
        const isUnavailable = reason !== null;
        return (
          <button
            key={m.value}
            type="button"
            disabled={isUnavailable}
            onClick={() => onPick(m.value)}
            className={cn(
              'flex w-full items-start gap-2 px-2.5 py-1.5 text-left transition-colors',
              isUnavailable ? 'cursor-not-allowed' : 'hover:bg-hover',
            )}
          >
            <StatusDot tone={isUnavailable ? 'neutral' : m.tone} size="sm" className="mt-1" />
            <span className="min-w-0 flex-1">
              <span
                className={cn(
                  'block font-medium',
                  isUnavailable ? 'text-disabled-foreground' : m.text,
                )}
              >
                {m.label}
              </span>
              <span
                className={cn(
                  'block text-secondary',
                  isUnavailable ? 'text-disabled-foreground' : 'text-muted-foreground',
                )}
              >
                {m.description}
              </span>
              {isUnavailable ? (
                <span className="block text-secondary text-muted-foreground">{reason}</span>
              ) : null}
            </span>
            {active ? (
              <span aria-hidden className="mt-0.5 text-secondary text-primary">
                ✓
              </span>
            ) : null}
          </button>
        );
      })}
    </AnchoredPopover>
  );
};
