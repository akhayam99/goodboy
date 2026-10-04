import { Fragment, useState } from 'react';
import type { KeyboardEvent } from 'react';
import type { ProviderId, WorkspaceId } from '@goodboy/types';
import { Button } from '@goodboy/ui';
import { useWorkflowDrag } from '../../../../shared/hooks/useWorkflowDrag';
import { useProviderPolicy } from '../../hooks/useProviderPolicy';
import { PROVIDER_LABEL } from '../../providerLabel';
import { policyRowStatus } from '../../policy/policyRowStatus';
import { POLICY_STATE_LABEL } from '../../policy/policyStateLabel';
import { dropTarget } from './dropTarget';
import { PolicyHint } from './PolicyHint';
import { reorderNote } from './reorderNote';
import { PolicyDropZone } from './PolicyDropZone';
import { ProviderPolicyRow } from './ProviderPolicyRow';

type Props = {
  readonly workspaceId: WorkspaceId;
  readonly hasReset?: boolean;
};

type MoveParams = {
  readonly id: ProviderId;
  readonly to: number;
};

type RowKeyParams = {
  readonly event: KeyboardEvent<HTMLLIElement>;
  readonly id: ProviderId;
  readonly index: number;
};

export const ProviderPolicyList = ({ workspaceId, hasReset = false }: Props) => {
  const policy = useProviderPolicy({ workspaceId });
  const [expanded, setExpanded] = useState<ProviderId | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState('');
  const { rows } = policy;

  const move = ({ id, to }: MoveParams) => {
    const from = rows.findIndex((row) => row.id === id);
    if (to < 0 || to >= rows.length || from === -1) {
      setAnnouncement(`${PROVIDER_LABEL[id]} is already ${to < 0 ? 'first' : 'last'}.`);
      return;
    }
    policy.moveTo({ id, to });
    const note = reorderNote({ rows, from, to, isDone: true });
    setSaved(note);
    setAnnouncement(
      `${PROVIDER_LABEL[id]} moved to position ${to + 1} of ${rows.length}. ${note}.`,
    );
  };

  const { drag, dropIndex, startStepDrag } = useWorkflowDrag({
    enabled: true,
    onReorder: (from, at) => {
      const row = rows[from];
      const to = dropTarget({ from, at });
      if (row === undefined || to === from) {
        return;
      }
      move({ id: row.id, to });
    },
  });

  const onRowKey = ({ event, id, index }: RowKeyParams) => {
    if (event.target !== event.currentTarget) {
      return;
    }
    if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        setExpanded((current) => (current === id ? null : id));
      }
      return;
    }
    event.preventDefault();
    const step = event.key === 'ArrowUp' ? -1 : 1;
    const list = event.currentTarget.parentElement;
    if (!event.altKey) {
      list?.querySelectorAll<HTMLElement>('[data-policy-row]')[index + step]?.focus();
      return;
    }
    move({ id, to: index + step });
    requestAnimationFrame(() => {
      list?.querySelector<HTMLElement>(`[data-policy-row="${id}"]`)?.focus();
    });
  };

  const dragNote =
    drag === null || dropIndex === null
      ? null
      : reorderNote({
          rows,
          from: drag.fromIndex,
          to: dropTarget({ from: drag.fromIndex, at: dropIndex }),
          isDone: false,
        });
  const summary = policy.summary;

  return (
    <div className="flex min-w-0 flex-col gap-1">
      <ul aria-label="Providers, in order, for this workspace" className="flex flex-col">
        {rows.map((row, index) => (
          <Fragment key={row.id}>
            <PolicyDropZone
              index={index}
              isShown={drag !== null}
              isActive={drag !== null && dropIndex === index}
            />
            <ProviderPolicyRow
              row={row}
              rank={index + 1}
              total={rows.length}
              status={policyRowStatus({ row, nowMs: policy.nowMs })}
              isExpanded={expanded === row.id}
              isDragging={drag?.fromIndex === index}
              dropIndex={drag === null ? undefined : index > drag.fromIndex ? index + 1 : index}
              onToggleExpand={() => setExpanded((current) => (current === row.id ? null : row.id))}
              onState={(state) => {
                policy.setState({ id: row.id, state });
                setSaved(null);
                setAnnouncement(`${PROVIDER_LABEL[row.id]} is ${POLICY_STATE_LABEL[state]}.`);
              }}
              onToggleMark={(mark) => policy.toggleMark({ id: row.id, mark })}
              onGripDown={(event) => startStepDrag(index, PROVIDER_LABEL[row.id], event)}
              onKeyDown={(event) => onRowKey({ event, id: row.id, index })}
            />
          </Fragment>
        ))}
        <PolicyDropZone
          index={rows.length}
          isShown={drag !== null}
          isActive={drag !== null && dropIndex === rows.length}
        />
      </ul>
      <div className="flex min-h-7 items-center gap-2 px-1">
        <PolicyHint dragNote={dragNote} saved={saved} />
        {hasReset ? (
          <Button
            size="sm"
            variant="ghost"
            disabled={!policy.isCustom}
            onClick={() => {
              policy.reset();
              setSaved('Back to every connected provider On');
              setAnnouncement('Providers reset to the connected order, all On.');
            }}
          >
            Reset
          </Button>
        ) : null}
      </div>
      <p role="status" aria-live="polite" className="sr-only">
        {announcement === '' ? '' : `${announcement} ${summary.text}.`}
      </p>
    </div>
  );
};
