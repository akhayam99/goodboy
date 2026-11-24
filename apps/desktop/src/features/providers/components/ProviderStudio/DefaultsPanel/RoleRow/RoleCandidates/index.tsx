import { useMemo } from 'react';
import { Check } from '@goodboy/ui/icons';
import { isAutoRoleStartable, parseAutoDelegationRole } from '@goodboy/core/auto';
import {
  bestCandidate,
  buildCandidates,
  CANDIDATE_CAUSES,
  type Candidate,
  type CandidateInputs,
  type CandidateScope,
} from '@goodboy/core/providers';
import type { AgentRole, WorkspaceId } from '@goodboy/types';
import { Eyebrow, ICON_SIZE, cn } from '@goodboy/ui';
import { ProviderGlyph } from '../../../../../../../shared/components/RoutingPicker/ProviderGlyph';
import {
  routingLabelParts,
  routingNameText,
} from '../../../../../../../shared/components/RoutingPicker/routingSummary';
import { useRoutingSnapshot } from '../../../../../hooks/useRoutingSnapshot';
import { roomTextOf } from '../../roomTextOf';

type Props = {
  readonly workspaceId: WorkspaceId;
  readonly role: AgentRole;
  readonly label: string;
};

type ScopeParams = {
  readonly role: AgentRole;
};

const candidateScopeOf = ({ role }: ScopeParams): CandidateScope => {
  const helper = parseAutoDelegationRole({ role });
  return helper !== null && isAutoRoleStartable({ role: helper }) ? 'helper' : 'step';
};

type RowParams = {
  readonly row: Candidate;
  readonly inputs: CandidateInputs;
};

type ModelParams = {
  readonly row: Candidate;
};

type MarkParams = {
  readonly row: Candidate;
  readonly best: Candidate | null;
};

const candidateMarkOf = ({ row, best }: MarkParams): 'out' | 'best' | 'valid' => {
  if (row.cause !== null) {
    return 'out';
  }
  return row === best ? 'best' : 'valid';
};

const modelTextOf = ({ row }: ModelParams): string => {
  const label = routingLabelParts({ provider: row.provider, model: row.model, effort: row.effort });
  return [routingNameText(label), ...label.detail].join(' · ');
};

const factsOf = ({ row, inputs }: RowParams): string => {
  if (row.cause !== null) {
    return CANDIDATE_CAUSES[row.cause].text;
  }
  return [
    `#${row.order} in your order`,
    roomTextOf({ provider: row.provider, inputs }),
    `${row.load} ${row.load === 1 ? 'agent' : 'agents'} in the last hour`,
    ...(row.isLighter ? ['lighter model'] : []),
  ].join(' · ');
};

export const RoleCandidates = ({ workspaceId, role, label }: Props) => {
  const snapshot = useRoutingSnapshot({ workspaceId });
  const list = useMemo(
    () =>
      snapshot === null
        ? null
        : buildCandidates({
            inputs: snapshot.inputs,
            need: { role, size: null, scope: candidateScopeOf({ role }) },
          }),
    [role, snapshot],
  );
  if (snapshot === null || list === null || list.rows.length === 0) {
    return null;
  }
  const best = bestCandidate({ list });
  const note = list.isPinned
    ? 'This role is pinned, so the first pinned model that can run wins.'
    : 'The check marks the pick by your provider priority. The Lead can pick another row when it fits the work better.';
  return (
    <section
      aria-label={`Candidates for ${label}`}
      className="flex flex-col gap-2 rounded-md border border-border bg-background p-3"
    >
      <Eyebrow label={`Candidates for ${label} right now`} />
      <ul className="flex flex-col gap-1">
        {list.rows.map((row) => {
          const mark = candidateMarkOf({ row, best });
          const isOut = mark === 'out';
          return (
            <li
              key={`${row.provider}:${row.model}:${row.effort ?? ''}`}
              data-candidate={mark}
              className="grid grid-cols-[16px_16px_minmax(0,10rem)_minmax(0,1fr)] items-center gap-x-2 text-meta"
            >
              <span className="text-success">
                {mark === 'best' ? (
                  <Check size={ICON_SIZE.row} aria-label="Pick by your provider priority" />
                ) : null}
              </span>
              <ProviderGlyph id={row.provider} size={ICON_SIZE.row} />
              <span
                className={cn(
                  'min-w-0 truncate',
                  isOut ? 'text-faint-foreground line-through' : 'text-foreground',
                )}
              >
                {modelTextOf({ row })}
              </span>
              <span className="min-w-0 truncate text-faint-foreground">
                {factsOf({ row, inputs: snapshot.inputs })}
              </span>
            </li>
          );
        })}
      </ul>
      <span className="text-meta text-faint-foreground">{note}</span>
    </section>
  );
};
