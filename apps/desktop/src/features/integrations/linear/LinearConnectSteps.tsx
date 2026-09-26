import { useEffect, useRef, useState } from 'react';
import { Check, ExternalLink, ShieldAlert } from 'lucide-react';
import { Button, formatError, Input, StatusDot } from '@goodboy/ui';
import type { WorkspaceId } from '@goodboy/types';
import { openUrl } from '../../../shared/lib/editor';
import { useAppStore } from '../../../store';
import { ConnectSteps, type ConnectStepDef } from '../components/ConnectSteps';
import { WhatGoodboyCanDo } from '../components/WhatGoodboyCanDo';
import { ICON_SIZE } from '../../../shared/components/conceptIcons';

const SECURITY_URL = 'https://linear.app/settings/account/security';
const VERIFY_DEBOUNCE_MS = 500;

type Props = {
  readonly workspaceId: WorkspaceId;
  readonly shouldAutoFocus?: boolean;
  readonly onConnected?: () => void;
};

export const LinearConnectSteps = ({
  workspaceId,
  shouldAutoFocus = false,
  onConnected,
}: Props) => {
  const connectLinear = useAppStore((s) => s.connectLinear);
  const [hasOpenedLink, setHasOpenedLink] = useState(false);
  const [token, setToken] = useState('');
  const [status, setStatus] = useState<'idle' | 'checking' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);
  const timerRef = useRef<number | null>(null);
  const attemptRef = useRef(0);

  useEffect(() => {
    return () => {
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current);
      }
    };
  }, []);

  const verify = async (candidate: string) => {
    const attempt = ++attemptRef.current;
    setStatus('checking');
    setError(null);
    try {
      await connectLinear({ workspaceId, token: candidate, credentialId: null });
      if (attemptRef.current === attempt) {
        onConnected?.();
      }
    } catch (verifyError) {
      if (attemptRef.current === attempt) {
        setStatus('error');
        setError(formatError(verifyError));
      }
    }
  };

  const onTokenChange = (value: string) => {
    setToken(value);
    setStatus('idle');
    setError(null);
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
    }
    const trimmed = value.trim();
    if (trimmed === '') {
      return;
    }
    timerRef.current = window.setTimeout(() => void verify(trimmed), VERIFY_DEBOUNCE_MS);
  };

  const step1Done = hasOpenedLink || token.trim() !== '';

  const steps: ReadonlyArray<ConnectStepDef> = [
    {
      id: 'open-linear',
      title: 'Create an API key in Linear',
      help: 'Under Security & access, New API key, with Read and Write access.',
      status: step1Done ? 'done' : 'current',
      content: step1Done ? undefined : (
        <Button
          size="sm"
          onClick={() => {
            setHasOpenedLink(true);
            void openUrl(SECURITY_URL);
          }}
        >
          Open Linear
          <ExternalLink size={ICON_SIZE.row} aria-hidden />
        </Button>
      ),
    },
    {
      id: 'paste-key',
      title: 'Paste your API key',
      status: step1Done ? 'current' : 'later',
      content: (
        <div className="flex min-w-0 flex-col gap-1.5">
          <label htmlFor="linear-api-key" className="sr-only">
            API key
          </label>
          <Input
            id="linear-api-key"
            type="password"
            autoFocus={shouldAutoFocus}
            placeholder="lin_api_…"
            value={token}
            onChange={(event) => onTokenChange(event.target.value)}
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck={false}
          />
          {status === 'checking' && (
            <span className="flex items-center gap-1.5 text-2xs text-muted-foreground">
              <StatusDot tone="info" size="sm" pulsing />
              Checking with Linear
            </span>
          )}
          {status === 'error' && error != null && (
            <span role="alert" className="flex items-start gap-1.5 text-2xs text-danger">
              <ShieldAlert size={ICON_SIZE.row} aria-hidden className="mt-0.5 shrink-0" />
              {error}
            </span>
          )}
          <span className="text-2xs text-muted-foreground">
            If you can&apos;t create keys, a Linear admin has turned them off for members.
          </span>
        </div>
      ),
    },
  ];

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <ConnectSteps steps={steps} ariaLabel="Connect Linear" />
      <WhatGoodboyCanDo
        title="What Goodboy can do with this"
        lines={[
          { icon: <Check size={ICON_SIZE.row} aria-hidden />, text: 'Reads issues and comments' },
          {
            icon: <Check size={ICON_SIZE.row} aria-hidden />,
            text: 'Comments, and edits descriptions and status',
          },
        ]}
      />
    </div>
  );
};
