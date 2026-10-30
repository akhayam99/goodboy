import { useEffect, useRef, useState } from 'react';
import type { AgentId, SessionId } from '@goodboy/types';
import { Button, ChoiceChips, FormActions, Input, StatusDot, TruncatedText } from '@goodboy/ui';
import { AUTO_STATE_TONE } from '../autoStateTone';
import type { NextAction } from '../nextActionOf';
import { useNextAction } from './useNextAction';

type Props = {
  readonly sessionId: SessionId;
  readonly rootAgentId: AgentId;
  readonly action: NextAction;
  readonly untold: string | null;
  readonly onUntold: (content: string | null) => void;
};

const TONE = AUTO_STATE_TONE.waitingOnYou;

export const AutoNextAction = ({ sessionId, rootAgentId, action, untold, onUntold }: Props) => {
  const model = useNextAction({ sessionId, rootAgentId, action, untold, onUntold });
  const cardRef = useRef<HTMLElement>(null);
  const hintRef = useRef<HTMLInputElement>(null);
  const [isHintOpen, setIsHintOpen] = useState(false);
  const picked = action.choices.find((choice) => choice.key === model.pickedKey);
  const isRetry = model.error !== null;
  const label = picked?.label ?? action.choices[0]?.label ?? 'Continue';
  const hasHint = isHintOpen || model.hint !== '';

  useEffect(() => {
    if (isHintOpen) {
      hintRef.current?.focus();
    }
  }, [isHintOpen]);

  return (
    <section
      ref={cardRef}
      aria-label="Next step"
      data-next-action={action.delegationId}
      className="flex min-w-0 flex-col gap-2 rounded-lg bg-subtle p-3 text-meta"
    >
      <div className="flex min-w-0 items-center gap-2">
        <StatusDot tone={TONE} size="sm" />
        <span className="shrink-0 text-meta text-muted-foreground">Next step</span>
        <TruncatedText className="min-w-0 truncate text-ui text-foreground" tooltip={action.title}>
          {action.title}
        </TruncatedText>
      </div>
      {untold !== null ? (
        <FormActions error={model.error}>
          <p className="min-w-0 flex-1 text-muted-foreground">Declined. Auto was not told.</p>
          <Button
            size="sm"
            isBusy={model.isBusy}
            busyLabel="Telling Auto"
            onClick={() => void model.tell()}
          >
            Tell Auto
          </Button>
        </FormActions>
      ) : model.lostNote !== null ? (
        <p role="status" className="text-muted-foreground">
          {model.lostNote}
        </p>
      ) : (
        <>
          <ChoiceChips
            ariaLabel="Next step choices"
            value={model.pickedKey}
            onChange={model.pick}
            keyScope={cardRef}
            options={action.choices.map((choice, index) => ({
              value: choice.key,
              label: choice.label,
              isDisabled: model.isBusy,
              isRecommended: index === 0,
            }))}
          />
          {hasHint ? (
            <Input
              ref={hintRef}
              aria-label="Add a hint"
              placeholder="Add a hint"
              value={model.hint}
              disabled={model.isBusy}
              onChange={(event) => model.setHint(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  void model.submit();
                }
              }}
            />
          ) : null}
          <FormActions
            error={model.error}
            leading={
              <>
                <Button
                  variant="quiet"
                  size="sm"
                  disabled={model.isBusy}
                  onClick={() => void model.notNow()}
                >
                  Not now
                </Button>
                {hasHint ? null : (
                  <Button
                    variant="quiet"
                    size="sm"
                    disabled={model.isBusy}
                    onClick={() => setIsHintOpen(true)}
                  >
                    Add a hint
                  </Button>
                )}
              </>
            }
          >
            <Button
              size="sm"
              isBusy={model.isBusy}
              busyLabel={isRetry ? 'Retrying' : 'Sending'}
              onClick={() => void model.submit()}
            >
              {isRetry ? 'Retry' : label}
            </Button>
          </FormActions>
        </>
      )}
    </section>
  );
};
