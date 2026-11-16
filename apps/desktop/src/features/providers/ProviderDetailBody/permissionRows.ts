import { modeSupportFor } from '@goodboy/core/permissions';
import { providerFlags } from '@goodboy/core/providers';
import type { ClaudePermissionMode, ProviderId } from '@goodboy/types';
import type { Tone } from '@goodboy/ui';
import { Check, EqualApproximately, X, type LucideIcon } from 'lucide-react';
import { modeCopyOf } from '../../permissions/modeCopy';

type Verdict = {
  readonly tone: Tone;
  readonly icon: LucideIcon;
  readonly word: string;
  readonly isFull: boolean;
};

export type PermissionRow = {
  readonly key: string;
  readonly label: string;
  readonly verdict: Verdict;
  readonly detail: string;
};

type Params = {
  readonly providerId: ProviderId;
};

type ModeParams = Params & {
  readonly mode: ClaudePermissionMode;
};

const WORKS: Verdict = { tone: 'success', icon: Check, word: 'Works', isFull: true };
const PARTLY: Verdict = {
  tone: 'warning',
  icon: EqualApproximately,
  word: 'Partly',
  isFull: false,
};
const MISSING: Verdict = { tone: 'neutral', icon: X, word: 'Not available', isFull: false };

const MODES: ReadonlyArray<ClaudePermissionMode> = [
  'plan',
  'default',
  'acceptEdits',
  'bypassPermissions',
];

const modeRow = ({ providerId, mode }: ModeParams): PermissionRow => {
  const support = modeSupportFor({ provider: providerId, mode });
  const meta = modeCopyOf({ mode });
  if (support.support === 'works') {
    return { key: mode, label: meta.label, verdict: WORKS, detail: meta.promise };
  }
  if (support.support === 'partly') {
    return { key: mode, label: meta.label, verdict: PARTLY, detail: support.reason ?? '' };
  }
  return {
    key: mode,
    label: meta.label,
    verdict: MISSING,
    detail: `Runs as ${modeCopyOf({ mode: support.runsAs }).label}`,
  };
};

const rulesRow = ({ providerId }: Params): PermissionRow =>
  providerFlags({ id: providerId }).canFollowRules
    ? {
        key: 'rules',
        label: 'Rules',
        verdict: WORKS,
        detail: 'Allow and Deny rules reach Claude as allowed and blocked tools.',
      }
    : {
        key: 'rules',
        label: 'Rules',
        verdict: { ...MISSING, word: 'Not followed' },
        detail: 'Only Claude follows Allow and Deny rules.',
      };

const ROLE_LIMITS_ROW: PermissionRow = {
  key: 'roles',
  label: 'Role limits',
  verdict: { ...PARTLY, word: 'Asked, not locked' },
  detail: '"Scout never edits" is an instruction, checked after the turn.',
};

export const permissionRows = ({ providerId }: Params): ReadonlyArray<PermissionRow> => [
  ...MODES.map((mode) => modeRow({ providerId, mode })),
  rulesRow({ providerId }),
  ROLE_LIMITS_ROW,
];
