import { useEffect, useRef, useState } from 'react';
import { ChevronDown, ShieldCheck } from 'lucide-react';
import {
  AnchoredPopover,
  Button,
  InlineConfirm,
  Tooltip,
  cn,
  tintClasses,
  useDropdown,
} from '@goodboy/ui';
import type { AgentId, PermissionScope, ProviderRunId, SessionId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { useToast } from '../../../../app/components/Toast';
import { ICON_SIZE } from '../../../../shared/components/conceptIcons';

type BroadScope = Extract<PermissionScope, 'project' | 'workspace' | 'global'>;

const SCOPE_LABELS: Record<PermissionScope, string> = {
  session: 'Allow for this session',
  once: 'Allow once',
  deny: 'Deny',
  project: 'Allow for this project',
  workspace: 'Allow for this workspace',
  global: 'Allow in every workspace',
};

const SCOPE_TITLES: Record<PermissionScope, string> = {
  session: 'Allowed until this session ends',
  once: 'Allowed for this call only, not saved',
  deny: 'Denied for the rest of this session',
  project: 'Allowed in every session of this project',
  workspace: 'Allowed in every session of this workspace',
  global: 'Allowed in every session of every workspace',
};

const BROAD_SCOPES: ReadonlyArray<BroadScope> = ['project', 'workspace', 'global'];

type Props = {
  readonly sessionId: SessionId;
  readonly agentId: AgentId;
  readonly toolUseId: string;
  readonly toolName: string;
  readonly runId: ProviderRunId;
  readonly onResolved: () => void;
};

export const PermissionScopePicker = ({
  sessionId,
  agentId,
  toolUseId,
  toolName,
  runId,
  onResolved,
}: Props) => {
  const resolvePermissionRequest = useAppStore((s) => s.resolvePermissionRequest);
  const reportError = useAppStore((s) => s.reportError);
  const { showToast } = useToast();
  const [busy, setBusy] = useState(false);
  const [isGlobalArmed, setIsGlobalArmed] = useState(false);
  const primaryRef = useRef<HTMLButtonElement>(null);
  const dropdown = useDropdown({ align: 'start', width: 'w-80', expectedWidth: 320 });
  const { open, close, toggle } = dropdown;

  useEffect(() => {
    if (document.activeElement !== null && document.activeElement !== document.body) {
      return;
    }
    primaryRef.current?.focus();
  }, []);

  useEffect(() => {
    if (open) {
      return;
    }
    setIsGlobalArmed(false);
  }, [open]);

  const handle = async (scope: PermissionScope) => {
    if (busy) {
      return;
    }
    setBusy(true);
    try {
      await resolvePermissionRequest({ sessionId, agentId, toolUseId, toolName, runId, scope });
      if (scope === 'deny') {
        showToast({ kind: 'info', message: `${toolName} denied for the rest of this session` });
      }
      close();
      onResolved();
    } catch (err) {
      void reportError({ title: `Couldn't answer the ${toolName} request`, error: err, sessionId });
    } finally {
      setBusy(false);
    }
  };

  const pickBroad = (scope: BroadScope) => {
    if (scope === 'global') {
      setIsGlobalArmed(true);
      return;
    }
    void handle(scope);
  };

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <Tooltip content={SCOPE_TITLES.session}>
        <Button ref={primaryRef} size="sm" disabled={busy} onClick={() => void handle('session')}>
          {SCOPE_LABELS.session}
        </Button>
      </Tooltip>
      <Tooltip content={SCOPE_TITLES.once}>
        <Button variant="secondary" size="sm" disabled={busy} onClick={() => void handle('once')}>
          {SCOPE_LABELS.once}
        </Button>
      </Tooltip>
      <Tooltip content={SCOPE_TITLES.deny}>
        <Button
          variant="ghost"
          size="sm"
          disabled={busy}
          onClick={() => void handle('deny')}
          className={cn('text-danger', tintClasses('danger').hoverBg, 'hover:text-danger')}
        >
          {SCOPE_LABELS.deny}
        </Button>
      </Tooltip>
      <AnchoredPopover
        dropdown={dropdown}
        role={isGlobalArmed ? 'dialog' : 'menu'}
        ariaLabel={isGlobalArmed ? `Allow ${toolName} in every workspace?` : 'More scopes'}
        className={isGlobalArmed ? undefined : 'py-1'}
        trigger={
          <Button
            variant="ghost"
            size="sm"
            disabled={busy}
            onClick={toggle}
            aria-haspopup="menu"
            aria-expanded={open}
          >
            More
            <ChevronDown size={ICON_SIZE.row} aria-hidden />
          </Button>
        }
      >
        {isGlobalArmed ? (
          <InlineConfirm
            role="alert"
            icon={<ShieldCheck size={ICON_SIZE.row} aria-hidden />}
            title={`Allow ${toolName} in every workspace?`}
            description="Every session in every workspace runs it without asking again."
            confirmLabel="Allow everywhere"
            surface="plain"
            isBusy={busy}
            onConfirm={() => handle('global')}
            onCancel={() => setIsGlobalArmed(false)}
          />
        ) : (
          BROAD_SCOPES.map((scope) => (
            <button
              key={scope}
              type="button"
              role="menuitem"
              disabled={busy}
              onClick={() => pickBroad(scope)}
              className="flex w-full flex-col items-start gap-0.5 px-2.5 py-1.5 text-left motion-safe:transition-colors hover:bg-hover"
            >
              <span className="text-label text-foreground">{SCOPE_LABELS[scope]}</span>
              <span className="text-secondary text-muted-foreground">{SCOPE_TITLES[scope]}</span>
            </button>
          ))
        )}
      </AnchoredPopover>
    </div>
  );
};
