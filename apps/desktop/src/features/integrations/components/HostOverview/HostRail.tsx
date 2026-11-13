import { ChecksProperty } from '../../../../shared/components/OverviewRail/ChecksProperty';
import { PeopleRows } from '../../../../shared/components/OverviewRail/PeopleRows';
import { PropertyField } from '../../../../shared/components/OverviewRail/PropertyField';
import { ReviewerRows } from '../../../../shared/components/OverviewRail/ReviewerRows';
import { HostLinkedIssues } from './HostLinkedIssues';
import type { HostRailFacts } from './types';

type Props = {
  readonly rail: HostRailFacts;
};

export const HostRail = ({ rail }: Props) => (
  <div
    aria-label="Overview"
    role="group"
    data-slot="side-column"
    className="flex min-w-0 flex-wrap gap-x-8 gap-y-6 @[880px]:flex-col @[880px]:flex-nowrap"
  >
    {rail.reviewers.length === 0 ? null : (
      <PropertyField label="Reviewers">
        <ReviewerRows people={rail.reviewers} />
      </PropertyField>
    )}
    <ChecksProperty summary={rail.checks} />
    <PeopleRows
      rows={
        rail.author === null
          ? []
          : [
              {
                login: rail.author.login,
                avatarUrl: rail.author.avatarUrl,
                isBot: false,
                note: 'Author',
              },
            ]
      }
    />
    <HostLinkedIssues linked={rail.linked} />
  </div>
);
