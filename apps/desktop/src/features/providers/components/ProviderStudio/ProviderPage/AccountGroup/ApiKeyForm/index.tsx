import { useState } from 'react';
import { PROVIDER_API_KEY_ENV } from '@goodboy/core/providers';
import type { ProviderId } from '@goodboy/types';
import { Button, FormActions, Input } from '@goodboy/ui';
import { useAppStore } from '../../../../../../../store';

type Props = {
  readonly providerId: ProviderId;
  readonly onClose: () => void;
};

const SAVE_FAILED = "Couldn't save the key. Check it and save again.";

export const ApiKeyForm = ({ providerId, onClose }: Props) => {
  const createCredential = useAppStore((state) => state.createCredential);
  const refreshProviders = useAppStore((state) => state.refreshProviders);
  const [apiKey, setApiKey] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const env = PROVIDER_API_KEY_ENV[providerId] ?? 'API key';
  const isEmpty = apiKey.trim() === '';

  const save = async () => {
    setIsSaving(true);
    setError(null);
    try {
      await createCredential(providerId, '', apiKey);
    } catch {
      setError(SAVE_FAILED);
      setIsSaving(false);
      return;
    }
    setIsSaving(false);
    onClose();
    void refreshProviders();
  };

  return (
    <form
      aria-label="Use an API key"
      className="flex flex-col gap-3 p-2"
      onSubmit={(event) => {
        event.preventDefault();
        if (!isEmpty && !isSaving) {
          void save();
        }
      }}
    >
      <Input
        autoFocus
        type="password"
        aria-label={env}
        placeholder={`Paste your ${env}`}
        value={apiKey}
        onChange={(event) => setApiKey(event.target.value)}
      />
      <FormActions error={error}>
        <Button variant="ghost" size="sm" onClick={onClose} disabled={isSaving}>
          Cancel
        </Button>
        <Button type="submit" size="sm" isBusy={isSaving} disabled={isEmpty || isSaving}>
          Save key
        </Button>
      </FormActions>
    </form>
  );
};
