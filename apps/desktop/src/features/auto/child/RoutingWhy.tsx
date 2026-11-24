import { useState } from 'react';
import { Check } from '@goodboy/ui/icons';
import { Disclosure, ICON_SIZE, cn } from '@goodboy/ui';
import { ProviderGlyph } from '../../../shared/components/RoutingPicker/ProviderGlyph';
import type { RoutingWhyModel } from './routingWhyOf';

type Props = {
  readonly why: RoutingWhyModel;
};

const CANDIDATES_LABEL = 'Candidates it weighed';

const STORED_LINE = 'Stored when the agent started. A message to this agent keeps its model.';

export const RoutingWhy = ({ why }: Props) => {
  const [isOpen, setIsOpen] = useState(false);
  return (
    <div data-routing-why="" className="flex min-w-0 flex-col gap-1">
      <p className="text-foreground">
        <span className="text-muted-foreground">{why.whyLabel}</span>
        {why.why}
      </p>
      {why.leadSaid === null ? null : (
        <p className="text-meta text-muted-foreground">{`The Lead said: "${why.leadSaid}"`}</p>
      )}
      {why.candidates.length === 0 ? null : (
        <Disclosure
          label={<span className="text-meta text-muted-foreground">{CANDIDATES_LABEL}</span>}
          isOpen={isOpen}
          onToggle={() => setIsOpen((wasOpen) => !wasOpen)}
          className="self-start"
        >
          <div className="flex min-w-0 flex-col gap-2">
            <ul aria-label={CANDIDATES_LABEL} className="flex min-w-0 flex-col gap-1">
              {why.candidates.map((candidate) => (
                <li
                  key={candidate.key}
                  aria-current={candidate.isPick ? 'true' : undefined}
                  data-candidate-struck={candidate.isStruck ? '' : undefined}
                  className="flex min-w-0 items-center gap-2 text-meta"
                >
                  <span className="flex w-3.5 shrink-0 items-center">
                    {candidate.isPick ? (
                      <Check size={ICON_SIZE.control} aria-hidden className="text-foreground" />
                    ) : null}
                  </span>
                  {candidate.provider === null ? null : (
                    <ProviderGlyph id={candidate.provider} size={ICON_SIZE.row} />
                  )}
                  <span
                    className={cn(
                      'shrink-0',
                      candidate.isPick ? 'text-foreground' : 'text-muted-foreground',
                      candidate.isStruck && 'line-through',
                    )}
                  >
                    {`${candidate.providerLabel} ${candidate.modelLabel}`}
                  </span>
                  <span className="min-w-0 truncate text-faint-foreground">{candidate.facts}</span>
                </li>
              ))}
            </ul>
            <p className="text-meta text-faint-foreground">{STORED_LINE}</p>
          </div>
        </Disclosure>
      )}
    </div>
  );
};
