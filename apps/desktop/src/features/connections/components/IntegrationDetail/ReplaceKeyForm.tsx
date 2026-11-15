import { useState } from 'react';
import { Button, FormActions, Input } from '@goodboy/ui';
import type { WorkspaceId, WorkspaceIntegrationProvider } from '@goodboy/types';
import { useAppStore } from '../../../../store';

type Props = {
  readonly workspaceId: WorkspaceId;
  readonly tool: WorkspaceIntegrationProvider;
  readonly label: string;
  readonly keyKind: string;
  readonly onSaved: () => void;
  readonly onCancel: () => void;
};

export const ReplaceKeyForm = ({ workspaceId, tool, label, keyKind, onSaved, onCancel }: Props) => {
  const replaceIntegrationKey = useAppStore((state) => state.replaceIntegrationKey);
  const [value, setValue] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const inputId = `replace-key-${tool}`;

  const save = async (): Promise<void> => {
    setIsSaving(true);
    setError(null);
    try {
      await replaceIntegrationKey({ workspaceId, provider: tool, secret: value });
      onSaved();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "The key wasn't saved.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <form
      aria-label={`Replace the ${label} key`}
      className="flex min-w-0 flex-col gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        void save();
      }}
    >
      <label htmlFor={inputId} className="text-row text-foreground">
        {`New ${keyKind.toLowerCase()}`}
      </label>
      <Input
        id={inputId}
        type="password"
        size="md"
        autoFocus
        autoComplete="off"
        spellCheck={false}
        value={value}
        disabled={isSaving}
        aria-invalid={error !== null}
        onChange={(event) => setValue(event.target.value)}
      />
      <FormActions
        leading={
          <span className="text-meta text-faint-foreground">
            {`${label} checks the key before it is saved. The connection stays as it is.`}
          </span>
        }
        error={
          error === null ? null : (
            <span className="flex flex-wrap items-center gap-2">
              <span>{error}</span>
              <Button
                type="button"
                size="xs"
                variant="secondary"
                isBusy={isSaving}
                busyLabel="Saving"
                onClick={() => void save()}
              >
                Retry
              </Button>
            </span>
          )
        }
      >
        <Button type="button" size="sm" variant="quiet" disabled={isSaving} onClick={onCancel}>
          Cancel
        </Button>
        <Button
          type="submit"
          size="sm"
          isBusy={isSaving}
          busyLabel="Saving"
          disabled={value.trim() === ''}
        >
          Save key
        </Button>
      </FormActions>
    </form>
  );
};
