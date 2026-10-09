import { ExternalLink } from 'lucide-react';
import { PULL_REQUEST_NOUNS, REVIEW_SOURCE_LABEL, type PullRequestCapability } from '@goodboy/core';
import { Button, SectionHeader } from '@goodboy/ui';
import { ICON_SIZE } from '../../../../shared/components/conceptIcons';
import { openUrl } from '../../../../shared/lib/editor';
import type { ActiveReviewSource } from '../../../../store/slices/review-source/types';
import { capabilityReasonOf } from '../../pullRequestCapabilityReason';

type Props = {
  readonly source: ActiveReviewSource;
};

type Control = {
  readonly label: string;
  readonly capability: PullRequestCapability;
};

const CONTROLS: ReadonlyArray<Control> = [
  { label: 'Edit title', capability: 'canEditTitle' },
  { label: 'Edit description', capability: 'canEditBody' },
  { label: 'Request review', capability: 'canRequestReviewers' },
  { label: 'Mark ready', capability: 'canSetDraft' },
  { label: 'Choose a merge method', capability: 'canChooseMergeMethod' },
];

export const HostRequestSummary = ({ source }: Props) => {
  const host = REVIEW_SOURCE_LABEL[source.kind];
  const nouns = PULL_REQUEST_NOUNS[source.kind];
  const url = source.url;
  return (
    <section aria-label={`${host} ${nouns.long}`} className="flex min-w-0 flex-col gap-4">
      <SectionHeader
        label={`${nouns.long.charAt(0).toUpperCase()}${nouns.long.slice(1)} on ${host}`}
        headingLevel={2}
        action={
          url === null ? null : (
            <Button size="xs" variant="ghost" onClick={() => void openUrl(url)}>
              Open on {host}
              <ExternalLink size={ICON_SIZE.row} aria-hidden />
            </Button>
          )
        }
      />
      <p className="text-label text-muted-foreground">
        {source.entry.label}. Goodboy shows its comments and checks status here. The rest happens on{' '}
        {host} for now.
      </p>
      <ul className="flex min-w-0 flex-col gap-1">
        {CONTROLS.map((control) => {
          const isMissingConcept =
            source.kind === 'bitbucket' && control.capability === 'canSetDraft';
          const reason = capabilityReasonOf({ kind: source.kind, capability: control.capability });
          return reason === null || isMissingConcept ? null : (
            <li key={control.capability} className="flex min-h-7 min-w-0 items-center gap-3">
              <Button size="xs" variant="secondary" disabled>
                {control.label}
              </Button>
              <span className="min-w-0 truncate text-meta text-faint-foreground">{reason}</span>
            </li>
          );
        })}
      </ul>
    </section>
  );
};
