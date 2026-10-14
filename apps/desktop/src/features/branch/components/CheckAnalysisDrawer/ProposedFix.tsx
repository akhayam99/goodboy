import { useState } from 'react';
import { Button, ChoiceCards, Markdown, StateBadge } from '@goodboy/ui';
import type { SessionId } from '@goodboy/types';
import { StartHint } from '../../../../shared/components/StartHint';
import { START_HINT_COPY } from '../../../../shared/components/startHintCopy';
import { optionSummary } from '../../checks/optionSummary';
import type { ProposalOptions } from '../../checks/proposalOptionsOf';
import { DrawerBox } from './DrawerBox';
import { Proposal } from './Proposal';

export type StartParams = {
  readonly optionKey: string | undefined;
};

type Props = {
  readonly sessionId: SessionId;
  readonly hintScope: string;
  readonly proposal: string;
  readonly options: ProposalOptions | null;
  readonly isActionable: boolean;
  readonly isStarting: boolean;
  readonly routing: string;
  readonly outcome: string | null;
  readonly onStart: (params: StartParams) => void;
  readonly onDismiss: () => void;
};

export const ProposedFix = ({
  sessionId,
  hintScope,
  proposal,
  options,
  isActionable,
  isStarting,
  routing,
  outcome,
  onStart,
  onDismiss,
}: Props) => {
  const [pickedKey, setPickedKey] = useState<string | null>(null);
  const selected =
    options === null
      ? undefined
      : (options.options.find((option) => option.key === pickedKey) ??
        options.options.find((option) => option.key === options.recommendedKey) ??
        options.options[0]);
  return (
    <DrawerBox label="Proposed fix">
      {options === null || selected === undefined ? (
        <Proposal text={proposal} />
      ) : (
        <>
          {options.lead.length === 0 ? null : <Markdown text={options.lead} />}
          <ChoiceCards
            ariaLabel="Fix options"
            className="sm:grid-cols-1"
            value={selected.key}
            onChange={setPickedKey}
            options={options.options.map((option) => ({
              value: option.key,
              label: `Option ${option.key}: ${option.title}`,
              ...(optionSummary({ body: option.body }).length > 0 && {
                hint: optionSummary({ body: option.body }),
              }),
              ...(option.key === options.recommendedKey && {
                badge: <StateBadge tone="info">Recommended</StateBadge>,
              }),
            }))}
          />
          <div
            role="tabpanel"
            aria-label={`Option ${selected.key}`}
            className="flex min-w-0 flex-col gap-3"
          >
            <Proposal text={selected.body} />
          </div>
          {options.reason.length === 0 || selected.key !== options.recommendedKey ? null : (
            <p className="text-meta text-muted-foreground">Why: {options.reason}</p>
          )}
        </>
      )}
      {isActionable ? (
        <StartHint
          sessionId={sessionId}
          scope={hintScope}
          label={START_HINT_COPY.implementerLabel}
          placeholder={START_HINT_COPY.checkFix}
        />
      ) : null}
      {isActionable ? (
        <div className="flex items-center gap-2">
          <Button
            variant="primary"
            size="sm"
            disabled={isStarting}
            onClick={() => onStart({ optionKey: selected?.key })}
          >
            {selected === undefined ? 'Start fix' : `Start option ${selected.key}`}
          </Button>
          <Button variant="ghost" size="sm" onClick={onDismiss}>
            Dismiss
          </Button>
          <span className="text-meta text-faint-foreground">Implementer · {routing}</span>
        </div>
      ) : null}
      {outcome === null ? null : (
        <p role="status" className="text-body text-muted-foreground">
          {outcome}
        </p>
      )}
    </DrawerBox>
  );
};
