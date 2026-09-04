import { Bug, CircleDot, GitPullRequest, MessagesSquare } from 'lucide-react';
import { Button, Chip, cn, Eyebrow, PANE_RHYTHM, ScrollFade, StatCard } from '@goodboy/ui';
import {
  IntegrationGlyph,
  integrationLabel,
} from '../../../integrations/components/IntegrationGlyph';
import { kindFilterCounts } from '../../kindFilter';
import { INBOX_PROVIDERS, type InboxRecord } from '../../types';
import { ICON_SIZE } from '../../../../shared/components/conceptIcons';

type Props = {
  readonly records: ReadonlyArray<InboxRecord>;
  readonly hasFiltersActive: boolean;
  readonly onClearFilters: () => void;
  readonly onOpenIntegrations: () => void;
};

export const InboxEmptySummary = ({
  records,
  hasFiltersActive,
  onClearFilters,
  onOpenIntegrations,
}: Props) => {
  const counts = kindFilterCounts({ records });
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
            <h2 className="text-lg font-semibold text-foreground">
              {hasFiltersActive ? 'No matching items' : 'Inbox is empty'}
            </h2>
            <p className="max-w-2xl text-sm text-muted-foreground">
              {hasFiltersActive
                ? 'Adjust the filters to bring items back into the list.'
                : 'Connect a provider to collect issues, reviews, threads and errors here.'}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
            <StatCard
              label="Issues"
              value={String(counts.issue)}
              icon={<CircleDot size={ICON_SIZE.hero} aria-hidden />}
              tone="info"
              valueSize="lg"
            />
            <StatCard
              label="PRs & MRs"
              value={String(counts['pr-mr'])}
              icon={<GitPullRequest size={ICON_SIZE.hero} aria-hidden />}
              tone="merged"
              valueSize="lg"
            />
            <StatCard
              label="Threads"
              value={String(counts.thread)}
              icon={<MessagesSquare size={ICON_SIZE.hero} aria-hidden />}
              tone="accent"
              valueSize="lg"
            />
            <StatCard
              label="Errors"
              value={String(counts.error)}
              icon={<Bug size={ICON_SIZE.hero} aria-hidden />}
              tone="danger"
              valueSize="lg"
            />
          </div>

          {providerCounts.length > 0 ? (
            <div className="flex flex-col gap-2">
              <Eyebrow label="Providers" />
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

          <div className="flex items-center gap-2">
            {hasFiltersActive ? (
              <Button variant="secondary" size="sm" onClick={onClearFilters}>
                Clear filters
              </Button>
            ) : (
              <Button variant="secondary" size="sm" onClick={onOpenIntegrations}>
                Open integrations
              </Button>
            )}
          </div>
        </div>
      </ScrollFade>
    </div>
  );
};
