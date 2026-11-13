import { StatusDot, TruncatedText } from '@goodboy/ui';
import { PROPERTY_ROW } from '../../../../shared/components/OverviewRail/propertyRow';
import { PropertyField } from '../../../../shared/components/OverviewRail/PropertyField';
import type { HostLinkedIssue } from './types';

type Props = {
  readonly linked: ReadonlyArray<HostLinkedIssue>;
};

export const HostLinkedIssues = ({ linked }: Props) => {
  if (linked.length === 0) {
    return null;
  }
  return (
    <PropertyField label="Linked issues">
      <ul className="flex min-w-0 flex-col">
        {linked.map((issue) => (
          <li key={issue.key} className={PROPERTY_ROW}>
            <StatusDot
              tone={issue.isClosing ? 'success' : 'neutral'}
              title={issue.isClosing ? 'Closes' : 'Mentions'}
            />
            <span className="shrink-0 text-code text-foreground">{issue.label}</span>
            <TruncatedText className="min-w-0 flex-1 text-foreground" tooltip={issue.title}>
              {issue.title}
            </TruncatedText>
          </li>
        ))}
      </ul>
    </PropertyField>
  );
};
