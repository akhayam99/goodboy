import { RotateCw } from 'lucide-react';
import { Button, Chip, type Tone } from '@goodboy/ui';
import { ICON_SIZE } from '../../../../shared/components/conceptIcons';
import type { AgentRow as AgentRowModel, AgentRowState } from '../agentRowOf';
import { AgentGlyph } from './AgentGlyph';
import { AgentRowPanel } from './AgentRowPanel';
import { StepListRow } from './StepListRow';
import { StepStatus } from './StepStatus';

type Props = {
  readonly row: AgentRowModel;
  readonly isDefault: boolean;
  readonly isOpen: boolean;
  readonly isLocked: boolean;
  readonly isChecking: boolean;
  readonly onToggle: () => void;
  readonly onMakeDefault: () => void;
  readonly onConnect: () => void;
  readonly onCancel: () => void;
  readonly onCheck: () => void;
};

type StatusCopy = {
  readonly tone: Tone;
  readonly label: string;
  readonly isPulsing: boolean;
};

const STATUS: Readonly<Record<AgentRowState, StatusCopy>> = {
  looking: { tone: 'info', label: 'Checking', isPulsing: true },
  unchecked: { tone: 'warning', label: "Couldn't check", isPulsing: false },
  ready: { tone: 'success', label: 'Ready', isPulsing: false },
  signin: { tone: 'warning', label: 'Not signed in', isPulsing: false },
  signing: { tone: 'info', label: 'Signing in', isPulsing: true },
  installing: { tone: 'info', label: 'Installing', isPulsing: true },
  failed: { tone: 'danger', label: "Didn't sign in", isPulsing: false },
  missing: { tone: 'neutral', label: 'Not installed', isPulsing: false },
  manual: { tone: 'neutral', label: 'Not installed', isPulsing: false },
  broken: { tone: 'danger', label: "Can't start", isPulsing: false },
};

const PANEL_ALWAYS_OPEN: ReadonlySet<AgentRowState> = new Set(['signing', 'installing', 'failed']);

const PANEL_ON_TOGGLE: ReadonlySet<AgentRowState> = new Set(['missing', 'manual', 'broken']);

type StatusParams = {
  readonly row: AgentRowModel;
};

const statusOf = ({ row }: StatusParams): StatusCopy => {
  if (row.state === 'manual' && row.isFound) {
    return { tone: 'warning', label: 'Not signed in', isPulsing: false };
  }
  return STATUS[row.state];
};

export const AgentRow = ({
  row,
  isDefault,
  isOpen,
  isLocked,
  isChecking,
  onToggle,
  onMakeDefault,
  onConnect,
  onCancel,
  onCheck,
}: Props) => {
  const status = statusOf({ row });
  const isPanelOpen =
    PANEL_ALWAYS_OPEN.has(row.state) || (PANEL_ON_TOGGLE.has(row.state) && isOpen);

  const actions = (() => {
    switch (row.state) {
      case 'ready':
        return isDefault ? (
          <Chip tone="primary" size="sm" label="Default" shape="badge" />
        ) : (
          <Button
            size="xs"
            variant="quiet"
            disabled={isLocked}
            aria-label={`Make ${row.label} the default agent`}
            onClick={onMakeDefault}
          >
            Make default
          </Button>
        );
      case 'signin':
        return (
          <Button
            size="sm"
            variant="secondary"
            disabled={isLocked}
            aria-label={`Sign in to ${row.label}`}
            onClick={onConnect}
          >
            Sign in
          </Button>
        );
      case 'signing':
      case 'installing':
        return (
          <Button size="sm" variant="quiet" aria-label={`Cancel ${row.label}`} onClick={onCancel}>
            Cancel
          </Button>
        );
      case 'failed':
        return (
          <Button size="sm" variant="secondary" disabled={isLocked} onClick={onConnect}>
            Retry
          </Button>
        );
      case 'missing':
      case 'manual':
        return (
          <Button
            size="sm"
            variant={isOpen ? 'quiet' : 'secondary'}
            aria-expanded={isOpen}
            aria-label={`${row.state === 'manual' ? 'Set up' : 'Install'} ${row.label}`}
            onClick={onToggle}
          >
            {row.state === 'manual' ? 'Set up' : 'Install'}
          </Button>
        );
      case 'broken':
        return (
          <>
            <Button size="sm" variant="quiet" aria-expanded={isOpen} onClick={onToggle}>
              Output
            </Button>
            <Button
              size="sm"
              variant="secondary"
              isBusy={isChecking}
              aria-label={`Check ${row.label} again`}
              onClick={onCheck}
            >
              <RotateCw size={ICON_SIZE.control} aria-hidden />
              Check again
            </Button>
          </>
        );
      case 'unchecked':
        return (
          <Button size="sm" variant="secondary" isBusy={isChecking} onClick={onCheck}>
            Check again
          </Button>
        );
      case 'looking':
        return null;
      default: {
        const unreachable: never = row.state;
        return unreachable;
      }
    }
  })();

  const statusMark = (
    <StepStatus tone={status.tone} label={status.label} isPulsing={status.isPulsing} />
  );

  return (
    <StepListRow
      rowId={row.id}
      icon={<AgentGlyph providerId={row.id} size={ICON_SIZE.hero} />}
      name={row.label}
      line={row.line}
      isDimmed={row.state === 'looking'}
      trailing={
        row.state === 'ready' ? (
          <>
            {actions}
            {statusMark}
          </>
        ) : (
          <>
            {statusMark}
            {actions}
          </>
        )
      }
      isPanelOpen={isPanelOpen}
      panel={<AgentRowPanel row={row} isLocked={isLocked} onRun={onConnect} />}
    />
  );
};
