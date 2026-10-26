import { useEffect, useRef, useState } from 'react';
import { Check, SquareArrowOutUpRight, ShieldAlert } from 'lucide-react';
import { Button, ICON_SIZE, Input, StatusDot } from '@goodboy/ui';
import type { WorkspaceId } from '@goodboy/types';
import { openUrl } from '../../../shared/lib/editor';
import { useAppStore } from '../../../store';
import { ConnectSteps, type ConnectStepDef } from '../components/ConnectSteps';
import { WhatGoodboyCanDo } from '../components/WhatGoodboyCanDo';
import { useDebouncedCheck } from '../hooks/useDebouncedCheck';

const SECURITY_URL = 'https://linear.app/settings/account/security';

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
  const onConnectedRef = useRef(onConnected);
  onConnectedRef.current = onConnected;

  const trimmedToken = token.trim();
  const check = useDebouncedCheck<void>({
    key: trimmedToken === '' ? null : trimmedToken,
    run: async () => {
      await connectLinear({ workspaceId, token: trimmedToken, credentialId: null });
    },
  });
  const status = check.status === 'checking' || check.status === 'error' ? check.status : 'idle';
  const error = check.status === 'error' ? check.error : null;

  useEffect(() => {
    if (check.status === 'ok') {
      onConnectedRef.current?.();
    }
  }, [check.status]);

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
          <SquareArrowOutUpRight size={ICON_SIZE.row} aria-hidden />
        </Button>
      ),
    },
    {
      id: 'paste-key',
      title: 'Paste your API key',
      status: step1Done ? 'current' : 'later',
      content: (
        <div className="flex min-w-0 flex-col gap-2">
          <label htmlFor="linear-api-key" className="sr-only">
            API key
          </label>
          <Input
            id="linear-api-key"
            type="password"
            autoFocus={shouldAutoFocus}
            placeholder="lin_api_…"
            value={token}
            onChange={(event) => setToken(event.target.value)}
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck={false}
          />
          {status === 'checking' && (
            <span className="flex items-center gap-1 text-meta text-muted-foreground">
              <StatusDot tone="info" size="sm" pulsing />
              Checking with Linear
            </span>
          )}
          {status === 'error' && error != null && (
            <span role="alert" className="flex items-start gap-1 text-meta text-danger">
              <ShieldAlert size={ICON_SIZE.row} aria-hidden className="mt-0.5 shrink-0" />
              {error}
            </span>
          )}
          <span className="text-meta text-muted-foreground">
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
