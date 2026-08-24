import { ChevronDown } from 'lucide-react';
import { AnchoredPopover, Chip, cn, StatusDot, type Tone, useDropdown } from '@goodboy/ui';
import type { ClaudePermissionMode, ProviderId, Session } from '@goodboy/types';
import { useAppStore } from '../../../../store';

const MODE_UNENFORCED_PROVIDERS: ReadonlyArray<ProviderId> = ['cursor', 'gemini'];

type ModeMeta = {
  readonly value: ClaudePermissionMode;
  readonly label: string;
  readonly description: string;
  readonly tone: Tone;
  readonly text: string;
};

const PERMISSION_MODES: ReadonlyArray<ModeMeta> = [
  {
    value: 'bypassPermissions',
    label: 'Bypass',
    description: 'Agent uses all tools freely, no prompts',
    tone: 'danger',
    text: 'text-danger',
  },
  {
    value: 'acceptEdits',
    label: 'Edits',
    description: 'File edits allowed, asks before bash',
    tone: 'warning',
    text: 'text-warning',
  },
  {
    value: 'default',
    label: 'Default',
    description: 'Asks before writes and runs',
    tone: 'info',
    text: 'text-info',
  },
  {
    value: 'plan',
    label: 'Plan',
    description: 'No tool calls executed, read-only',
    tone: 'neutral',
    text: 'text-muted-foreground',
  },
];

export const permissionModeMeta = (mode: ClaudePermissionMode): ModeMeta => {
  return PERMISSION_MODES.find((m) => m.value === mode) ?? PERMISSION_MODES[0]!;
};

type Props = {
  readonly session: Session;
  readonly activeProvider: ProviderId;
};

export const PermissionModePicker = ({ session, activeProvider }: Props) => {
  const dropdown = useDropdown({
    width: 'w-64',
    expectedHeight: 240,
    openEvent: 'goodboy:open-permission-picker',
  });
  const { open, close, toggle } = dropdown;
  const setSessionPermissionMode = useAppStore((s) => s.setSessionPermissionMode);
  const current = permissionModeMeta(session.permissionMode);
  const unenforced = MODE_UNENFORCED_PROVIDERS.includes(activeProvider);

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
          title={unenforced ? 'Not enforced for cursor and gemini' : current.description}
          hasPopup="dialog"
          expanded={open}
          className="gap-1.5 bg-subtle px-2.5 py-0.5 hover:bg-muted hover:opacity-100"
          icon={<StatusDot tone={current.tone} size="sm" />}
          label={<span className={cn(current.text)}>{current.label}</span>}
          trailing={<ChevronDown size={11} aria-hidden className="text-muted-foreground/70" />}
        />
      }
    >
      <div className="flex items-center px-2.5 pb-0.5 pt-1">
        <span className="text-2xs uppercase tracking-wide text-muted-foreground/70">
          Permission mode
        </span>
      </div>
      {PERMISSION_MODES.map((m) => {
        const active = session.permissionMode === m.value;
        return (
          <button
            key={m.value}
            type="button"
            onClick={() => onPick(m.value)}
            className={cn(
              'flex w-full items-start gap-2 px-2.5 py-1.5 text-left transition-colors hover:bg-muted',
              active ? '' : 'opacity-80',
            )}
          >
            <StatusDot tone={m.tone} size="sm" className="mt-1" />
            <span className="min-w-0 flex-1">
              <span className={cn('block font-medium', m.text)}>{m.label}</span>
              <span className="block text-2xs text-muted-foreground">{m.description}</span>
            </span>
            {active ? (
              <span aria-hidden className="mt-0.5 text-2xs text-primary">
                ✓
              </span>
            ) : null}
          </button>
        );
      })}
      {unenforced ? (
        <p className="px-2.5 pb-1 pt-1.5 text-2xs text-muted-foreground/80">
          Not enforced for cursor and gemini.
        </p>
      ) : null}
    </AnchoredPopover>
  );
};
