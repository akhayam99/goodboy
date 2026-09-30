import { modeSupportFor } from '@goodboy/core';
import type { ClaudePermissionMode, ProviderId } from '@goodboy/types';
import { BAND_ROW_CLASS, Band, cn, tintClasses, type Tone } from '@goodboy/ui';
import { Check, EqualApproximately, X, type LucideIcon } from 'lucide-react';
import { modeCopyOf } from '../../../../permissions/modeCopy';
import { ICON_SIZE } from '../../../../../shared/components/conceptIcons';
import { PROVIDER_LABEL } from '../../../providerLabel';

type Props = {
  readonly providerId: ProviderId;
};

type Verdict = {
  readonly tone: Tone;
  readonly icon: LucideIcon;
  readonly word: string;
};

type PermissionRow = {
  readonly key: string;
  readonly label: string;
  readonly verdict: Verdict;
  readonly detail: string;
};

const WORKS: Verdict = { tone: 'success', icon: Check, word: 'Works' };
const PARTLY: Verdict = { tone: 'warning', icon: EqualApproximately, word: 'Partly' };
const MISSING: Verdict = { tone: 'neutral', icon: X, word: 'Not available' };

const MODES: ReadonlyArray<ClaudePermissionMode> = [
  'plan',
  'default',
  'acceptEdits',
  'bypassPermissions',
];

const modeRow = ({
  providerId,
  mode,
}: {
  readonly providerId: ProviderId;
  readonly mode: ClaudePermissionMode;
}): PermissionRow => {
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

const rulesRow = ({ providerId }: Props): PermissionRow =>
  providerId === 'anthropic'
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

export const PermissionsGroup = ({ providerId }: Props) => {
  const rows: ReadonlyArray<PermissionRow> = [
    ...MODES.map((mode) => modeRow({ providerId, mode })),
    rulesRow({ providerId }),
    ROLE_LIMITS_ROW,
  ];
  const label = `Permissions with ${PROVIDER_LABEL[providerId]}`;
  return (
    <Band label={label} ariaLabel={label}>
      <ul className="flex flex-col">
        {rows.map((row) => {
          const tint = tintClasses(row.verdict.tone);
          const Icon = row.verdict.icon;
          return (
            <li key={row.key} className={cn(BAND_ROW_CLASS, 'gap-3 text-label')}>
              <span className="w-28 shrink-0 truncate text-foreground">{row.label}</span>
              <span
                className={cn(
                  'flex w-36 shrink-0 items-center gap-1',
                  row.verdict.tone === 'neutral' ? 'text-muted-foreground' : tint.text,
                )}
              >
                <Icon size={ICON_SIZE.row} aria-hidden />
                {row.verdict.word}
              </span>
              <span className="min-w-0 flex-1 truncate text-muted-foreground">{row.detail}</span>
            </li>
          );
        })}
      </ul>
    </Band>
  );
};
