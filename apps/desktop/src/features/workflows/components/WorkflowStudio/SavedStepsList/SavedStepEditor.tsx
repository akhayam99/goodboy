import { useState, type KeyboardEvent } from 'react';
import { Copy, Trash2 } from 'lucide-react';
import { Button, InlineConfirm } from '@goodboy/ui';
import type { ProviderId } from '@goodboy/types';
import type { StepDraft } from '../../../engine';
import { stepDraftWithModel } from '../../../engine';
import { ICON_SIZE } from '../../../../../shared/components/conceptIcons';
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
  const [isConfirmingRemove, setIsConfirmingRemove] = useState(false);
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
        onProvider={(provider) => onChange({ provider })}
        onModel={(model) =>
          onChange(
            stepDraftWithModel({ step: draft, provider: draft.provider, model, recommendedModel }),
          )
        }
        onEffort={(effort) => onChange({ effort })}
        onVerbosity={(verbosity) => onChange({ verbosity })}
        onRoutingReset={() => onChange({ provider: '', model: '' })}
      />
      {isConfirmingRemove ? (
        <InlineConfirm
          role="danger"
          icon={<Trash2 size={ICON_SIZE.row} aria-hidden />}
          title={`Remove ${draft.name.trim() === '' ? 'this step' : draft.name.trim()}?`}
          description="Workflows that already use it keep their own copy."
          confirmLabel="Remove step"
          isBusy={isBusy}
          onConfirm={onRemove}
          onCancel={() => setIsConfirmingRemove(false)}
        />
      ) : (
        <div className="flex items-center justify-end gap-1">
          {error === null ? null : (
            <p role="alert" className="min-w-0 flex-1 truncate text-2xs text-danger">
              {error}
            </p>
          )}
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
              onClick={() => setIsConfirmingRemove(true)}
              disabled={isBusy}
              className="text-danger"
            >
              Remove
            </Button>
          ) : null}
          {mode === 'new' ? (
            <Button variant="ghost" size="sm" onClick={onRemove} disabled={isBusy}>
              Discard
            </Button>
          ) : null}
          <Button
            variant="secondary"
            size="sm"
            onClick={onDone}
            isBusy={mode !== 'builtin' && isBusy}
          >
            {mode === 'new' ? 'Save step' : 'Done'}
          </Button>
        </div>
      )}
    </div>
  );
};
