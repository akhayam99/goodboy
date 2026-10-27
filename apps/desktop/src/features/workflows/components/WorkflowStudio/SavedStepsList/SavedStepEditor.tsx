import type { KeyboardEvent } from 'react';
import { Copy } from 'lucide-react';
import { Button, FormActions, ICON_SIZE } from '@goodboy/ui';
import type { ProviderId } from '@goodboy/types';
import type { StepDraft } from '../../../engine';

import { StepEditorFields } from '../../StepTree/StepEditorFields';

type Mode = 'builtin' | 'saved' | 'new';

type Props = {
  readonly mode: Mode;
  readonly draft: StepDraft;
  readonly recommendedProvider: ProviderId;
  readonly recommendedModel: string;
  readonly connectedProviders: ReadonlyArray<ProviderId>;
  readonly isBusy: boolean;
  readonly error: string | null;
  readonly onChange: (patch: Partial<StepDraft>) => void;
  readonly onSaveCopy: () => void;
  readonly onRemove: () => void;
  readonly onDone: () => void;
};

export const SavedStepEditor = ({
  mode,
  draft,
  recommendedProvider,
  recommendedModel,
  connectedProviders,
  isBusy,
  error,
  onChange,
  onSaveCopy,
  onRemove,
  onDone,
}: Props) => {
  const isReadOnly = mode === 'builtin';
  const disabled = isReadOnly || isBusy;

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'Escape' || event.defaultPrevented) {
      return;
    }
    event.stopPropagation();
    onDone();
  };

  return (
    <div className="@container flex flex-col gap-3 px-3 pb-3 pt-1" onKeyDown={onKeyDown}>
      <StepEditorFields
        step={draft}
        routingLabel={`Routing for ${draft.name.trim() === '' ? 'this step' : draft.name.trim()}`}
        effort={draft.effort}
        recommendedProvider={recommendedProvider}
        recommendedModel={recommendedModel}
        connectedProviders={connectedProviders}
        isRoutingOverridden={draft.provider !== '' || draft.model !== ''}
        disabled={disabled}
        polish={null}
        onName={(name) => onChange({ name })}
        onRole={(role) => onChange({ role })}
        onPrompt={(prompt) => onChange({ prompt })}
        onExpectedOutput={(expectedOutput) => onChange({ expectedOutput })}
        onRoute={onChange}
        onVerbosity={(verbosity) => onChange({ verbosity })}
        onRoutingReset={() => onChange({ provider: '', model: '' })}
        onPin={() => onChange({ provider: recommendedProvider, model: recommendedModel })}
      />
      <FormActions
        leading={
          error === null ? null : (
            <p role="alert" className="min-w-0 truncate text-meta text-danger">
              {error}
            </p>
          )
        }
      >
        {mode === 'builtin' ? (
          <Button variant="ghost" size="sm" onClick={onSaveCopy} isBusy={isBusy}>
            <Copy size={ICON_SIZE.row} aria-hidden />
            Save a copy
          </Button>
        ) : null}
        {mode === 'saved' ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={onRemove}
            disabled={isBusy}
            className="text-danger"
          >
            Remove
          </Button>
        ) : null}
        {mode === 'new' ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={onRemove}
            disabled={isBusy}
            className="text-muted-foreground"
          >
            Discard
          </Button>
        ) : null}
        <Button
          variant={mode === 'new' ? 'primary' : 'secondary'}
          size="sm"
          onClick={onDone}
          isBusy={mode !== 'builtin' && isBusy}
        >
          {mode === 'new' ? 'Save step' : 'Done'}
        </Button>
      </FormActions>
    </div>
  );
};
