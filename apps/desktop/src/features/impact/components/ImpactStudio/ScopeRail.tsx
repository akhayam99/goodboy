import { cn, formatUsd, SelectableRow, tintClasses } from '@goodboy/ui';
import { Gauge, GitPullRequest, LayoutDashboard, Timer, type LucideIcon } from 'lucide-react';
import type { ProviderSpendEntry } from '../../../../store';
import { ICON_SIZE } from '../../../../shared/components/conceptIcons';
import { InlineMarkdown } from '../../../../shared/components/InlineMarkdown';
import { stripInlineMarkdown } from '../../../../shared/components/InlineMarkdown/stripInlineMarkdown';
import { ProviderIcon } from '../../../providers/components/ProviderIcon';
import { providerLabel, spendTone, type SessionSpend } from '../../../budget/components/spend/lib';
import type { ImpactScope, ImpactScopeId } from '../../lib';
import { RailGroupLabel } from './RailGroupLabel';

type Props = {
  readonly scope: ImpactScope;
  readonly providers: ReadonlyArray<ProviderSpendEntry>;
  readonly sessions: ReadonlyArray<SessionSpend>;
  readonly onSelect: (scope: ImpactScope) => void;
};

const SECTIONS: ReadonlyArray<{
  readonly id: ImpactScopeId;
  readonly label: string;
  readonly icon: LucideIcon;
}> = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'shipped', label: 'Shipped', icon: GitPullRequest },
  { id: 'flow', label: 'Flow', icon: Timer },
  { id: 'efficiency', label: 'Efficiency', icon: Gauge },
];

export const ScopeRail = ({ scope, providers, sessions, onSelect }: Props) => (
  <div className="flex flex-col gap-3 p-3">
    <ul className="flex flex-col gap-0.5">
      {SECTIONS.map((section) => {
        const Icon = section.icon;
        const isActive = scope.kind === section.id;
        return (
          <li key={section.id}>
            <SelectableRow
              selected={isActive}
              ariaCurrent={isActive}
              onClick={() => onSelect({ kind: section.id })}
              className="items-center gap-2.5 px-2.5 py-2 text-sm"
            >
              <Icon size={ICON_SIZE.control} aria-hidden className="shrink-0" />
              {section.label}
            </SelectableRow>
          </li>
        );
      })}
    </ul>

    {providers.length > 0 ? (
      <div className="flex flex-col gap-1">
        <RailGroupLabel label="spend by provider" count={providers.length} />
        <ul className="flex flex-col gap-0.5">
          {providers.map((entry) => {
            const isActive = scope.kind === 'provider' && scope.provider === entry.provider;
            const tone = spendTone({ pct: entry.pct });
            return (
              <li key={entry.provider}>
                <SelectableRow
                  selected={isActive}
                  ariaCurrent={isActive}
                  onClick={() => onSelect({ kind: 'provider', provider: entry.provider })}
                  className="flex-col gap-1.5 px-2.5 py-2"
                >
                  <div className="flex w-full items-center gap-2.5">
                    <ProviderIcon provider={entry.provider} size={ICON_SIZE.control} />
                    <span className="flex-1 truncate text-sm font-medium capitalize text-foreground">
                      {providerLabel(entry.provider)}
                    </span>
                    <span className="shrink-0 font-mono text-2xs tabular-nums text-muted-foreground">
                      {formatUsd(entry.spentUsd)}
                    </span>
                  </div>
                  {entry.capUsd === null ? null : (
                    <div className="h-1 w-full overflow-hidden rounded-full bg-muted">
                      <div
                        className={cn('h-full rounded-full', tintClasses(tone).dot)}
                        style={{ width: `${Math.min(entry.pct, 1) * 100}%` }}
                      />
                    </div>
                  )}
                </SelectableRow>
              </li>
            );
          })}
        </ul>
      </div>
    ) : null}

    {sessions.length > 0 ? (
      <div className="flex flex-col gap-1">
        <RailGroupLabel label="spend by session" count={sessions.length} />
        <ul className="flex flex-col gap-0.5">
          {sessions.map((session) => {
            const isActive = scope.kind === 'session' && scope.sessionId === session.sessionId;
            return (
              <li key={session.sessionId}>
                <SelectableRow
                  selected={isActive}
                  ariaCurrent={isActive}
                  onClick={() => onSelect({ kind: 'session', sessionId: session.sessionId })}
                  title={stripInlineMarkdown({ text: session.goal })}
                  className="items-center gap-2 px-2.5 py-2"
                >
                  {session.isCurrent ? (
                    <span
                      aria-label="Current session"
                      className="size-1.5 shrink-0 rounded-full bg-success"
                    />
                  ) : (
                    <span aria-hidden className="size-1.5 shrink-0 rounded-full bg-border-soft" />
                  )}
                  <InlineMarkdown text={session.goal} className="min-w-0 flex-1 truncate text-sm" />
                  <span className="shrink-0 font-mono text-2xs tabular-nums text-muted-foreground">
                    {formatUsd(session.spentUsd)}
                  </span>
                </SelectableRow>
              </li>
            );
          })}
        </ul>
      </div>
    ) : null}
  </div>
);
