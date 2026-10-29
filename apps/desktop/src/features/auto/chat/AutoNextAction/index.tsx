import type { KeyboardEvent } from 'react';
import type { AgentId, SessionId } from '@goodboy/types';
import {
  Button,
  ChoiceCards,
  FormActions,
  Input,
  ToneBar,
  TruncatedText,
  cn,
  tintClasses,
} from '@goodboy/ui';
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

type PickKeyParams = {
  readonly event: KeyboardEvent<HTMLElement>;
  readonly keys: ReadonlyArray<string>;
};

const TONE = AUTO_STATE_TONE.waitingOnYou;

const pickKeyOf = ({ event, keys }: PickKeyParams): string | undefined => {
  const isTyping = event.target instanceof HTMLInputElement;
  if (isTyping || event.metaKey || event.ctrlKey || event.altKey) {
    return undefined;
  }
  return keys[Number(event.key) - 1];
};

export const AutoNextAction = ({ sessionId, rootAgentId, action, untold, onUntold }: Props) => {
  const model = useNextAction({ sessionId, rootAgentId, action, untold, onUntold });
  const tint = tintClasses(TONE);
  const picked = action.choices.find((choice) => choice.key === model.pickedKey);
  const isRetry = model.error !== null;
  const label = picked?.label ?? action.choices[0]?.label ?? 'Continue';

  return (
    <section
      aria-label="Next step"
      data-next-action={action.delegationId}
      onKeyDown={(event) => {
        const key = pickKeyOf({ event, keys: action.choices.map((choice) => choice.key) });
        if (key !== undefined && !model.isBusy) {
          model.pick(key);
        }
      }}
      className="relative flex min-w-0 flex-col gap-2 rounded-lg bg-elevated py-3 pl-4 pr-3 text-meta"
    >
      <ToneBar tone={TONE} density="card" />
      <p className={cn('text-eyebrow', tint.text)}>Next step</p>
      <TruncatedText className="min-w-0 truncate text-foreground" tooltip={action.title}>
        {action.title}
      </TruncatedText>
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
          <ChoiceCards
            ariaLabel="Next step choices"
            value={model.pickedKey}
            onChange={model.pick}
            options={action.choices.map((choice, index) => ({
              value: choice.key,
              label: choice.label,
              glyph: <span className="text-faint-foreground">{index + 1}</span>,
              disabled: model.isBusy,
              ...(index === 0 ? { badge: <span className={tint.text}>Recommended</span> } : {}),
            }))}
          />
          <Input
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
          <FormActions
            error={model.error}
            leading={
              <Button
                variant="quiet"
                size="sm"
                disabled={model.isBusy}
                onClick={() => void model.notNow()}
              >
                Not now
              </Button>
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
