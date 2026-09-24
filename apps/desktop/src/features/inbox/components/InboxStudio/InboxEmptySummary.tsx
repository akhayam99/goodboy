import { Bug, CircleDot, GitPullRequest, MessagesSquare } from 'lucide-react';
import { Button, Chip, cn, Eyebrow, PANE_RHYTHM, ScrollFade, StatCard } from '@goodboy/ui';
import {
  IntegrationGlyph,
  integrationLabel,
} from '../../../integrations/components/IntegrationGlyph';
import { INBOX_KIND_PROVIDERS, kindFilterCounts, visibleKindFilters } from '../../kindFilter';
import type { InboxKindFilter } from '../../kindFilter';
import { INBOX_PROVIDERS, type InboxProvider, type InboxRecord } from '../../types';
import { ICON_SIZE } from '../../../../shared/components/conceptIcons';
import { NOT_LOADED_HINT, UNKNOWN_VALUE } from '../../../../shared/utils/unknownValue';

type Props = {
  readonly records: ReadonlyArray<InboxRecord>;
  readonly hasVisibleRecords: boolean;
  readonly hasFiltersActive: boolean;
  readonly errors: Readonly<Record<InboxProvider, string | null>>;
  readonly connected: ReadonlyArray<InboxProvider>;
  readonly onRetry: () => void;
  readonly onClearFilters: () => void;
  readonly onOpenIntegrations: () => void;
};

type Reason = 'failed' | 'nothing-connected' | 'all-clear' | 'no-matches' | 'no-selection';

type TileKind = Exclude<InboxKindFilter, 'all'>;

type ReasonCopy = {
  readonly title: string;
  readonly description: string;
};

const REASON_COPY: Record<Exclude<Reason, 'failed'>, ReasonCopy> = {
  'nothing-connected': {
    title: 'Inbox is empty',
    description: 'Connect a tool to collect issues, reviews, threads and errors here.',
  },
  'all-clear': {
    title: 'Nothing assigned to you',
    description: 'Connected tools have no open issues, reviews, threads or errors for you.',
  },
  'no-matches': {
    title: 'No matching items',
    description: 'Adjust the filters to bring items back into the list.',
  },
  'no-selection': {
    title: 'Nothing selected',
    description: 'Pick an item from the list to open it here.',
  },
};

export const InboxEmptySummary = ({
  records,
  hasVisibleRecords,
  hasFiltersActive,
  errors,
  connected,
  onRetry,
  onClearFilters,
  onOpenIntegrations,
}: Props) => {
  const failedProviders = INBOX_PROVIDERS.filter((provider) => errors[provider] !== null);
  const reason: Reason = ((): Reason => {
    if (hasVisibleRecords) {
      return 'no-selection';
    }
    if (records.length > 0 || hasFiltersActive) {
      return 'no-matches';
    }
    if (failedProviders.length > 0) {
      return 'failed';
    }
    return connected.length === 0 ? 'nothing-connected' : 'all-clear';
  })();
  const copy: ReasonCopy =
    reason === 'failed'
      ? {
          title: 'Some tools did not load',
          description: `${failedProviders.map((provider) => integrationLabel({ provider })).join(', ')} did not answer, so this is not everything assigned to you.`,
        }
      : REASON_COPY[reason];
  const counts = kindFilterCounts({ records });
  const tile = ({ kind }: { readonly kind: TileKind }) => {
    const isUnknown =
      counts[kind] === 0 &&
      INBOX_KIND_PROVIDERS[kind].some((provider) => errors[provider] !== null);
    return isUnknown
      ? { value: UNKNOWN_VALUE, hint: NOT_LOADED_HINT }
      : { value: String(counts[kind]), hint: undefined };
  };
  const hasPullRequestFeed = visibleKindFilters({ connected }).includes('pr-mr');
  const providerCounts = INBOX_PROVIDERS.map((provider) => ({
    provider,
    count: records.filter((record) => record.provider === provider).length,
  })).filter(({ count }) => count > 0);

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <ScrollFade className="min-h-0 flex-1">
        <div className={cn('flex flex-col gap-6', PANE_RHYTHM.body)}>
          <div className="flex flex-col gap-2">
            <Eyebrow label="Inbox summary" />
            <h2 className="text-lg font-semibold text-foreground">{copy.title}</h2>
            <p className="max-w-2xl text-sm text-muted-foreground">{copy.description}</p>
          </div>

          <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
            <StatCard
              label="Issues"
              {...tile({ kind: 'issue' })}
              icon={<CircleDot size={ICON_SIZE.hero} aria-hidden />}
              tone="info"
              valueSize="lg"
            />
            {hasPullRequestFeed ? (
              <StatCard
                label="PRs & MRs"
                {...tile({ kind: 'pr-mr' })}
                icon={<GitPullRequest size={ICON_SIZE.hero} aria-hidden />}
                tone="merged"
                valueSize="lg"
              />
            ) : null}
            <StatCard
              label="Threads"
              {...tile({ kind: 'thread' })}
              icon={<MessagesSquare size={ICON_SIZE.hero} aria-hidden />}
              tone="primary"
              valueSize="lg"
            />
            <StatCard
              label="Errors"
              {...tile({ kind: 'error' })}
              icon={<Bug size={ICON_SIZE.hero} aria-hidden />}
              tone="danger"
              valueSize="lg"
            />
          </div>

          {providerCounts.length > 0 ? (
            <div className="flex flex-col gap-2">
              <Eyebrow label="Tools" />
              <div className="flex flex-wrap gap-2">
                {providerCounts.map(({ provider, count }) => (
                  <Chip
                    key={provider}
                    tone="neutral"
                    icon={<IntegrationGlyph provider={provider} size="xs" useBrandColor />}
                    label={integrationLabel({ provider })}
                    trailing={<span className="font-mono tabular-nums">{count}</span>}
                  />
                ))}
              </div>
            </div>
          ) : null}

          {reason === 'no-selection' || reason === 'all-clear' ? null : (
            <div className="flex items-center gap-2">
              {reason === 'no-matches' ? (
                <Button variant="secondary" size="sm" onClick={onClearFilters}>
                  Clear filters
                </Button>
              ) : null}
              {reason === 'failed' ? (
                <Button variant="secondary" size="sm" onClick={onRetry}>
                  Retry
                </Button>
              ) : null}
              {reason === 'nothing-connected' ? (
                <Button variant="secondary" size="sm" onClick={onOpenIntegrations}>
                  Connect tools
                </Button>
              ) : null}
            </div>
          )}
        </div>
      </ScrollFade>
    </div>
  );
};
