import { useCallback, useRef, useState } from 'react';

export type HandoffState = 'idle' | 'shared' | 'copied';

type HandoffResult = HandoffState | 'cancelled' | 'failed';

type Params = {
  readonly url: string;
  readonly title: string;
  readonly text: string;
};

type CopyParams = {
  readonly url: string;
};

type SettleParams = {
  readonly result: HandoffResult;
};

type Handoff = {
  readonly state: HandoffState;
  readonly canShare: boolean;
  readonly handoff: () => void;
};

const isAbort = (error: unknown): boolean =>
  typeof error === 'object' && error !== null && 'name' in error && error.name === 'AbortError';

const canUseShare = (): boolean => typeof navigator.share === 'function';

const copyLink = async ({ url }: CopyParams): Promise<HandoffResult> => {
  if (navigator.clipboard === undefined) {
    return 'failed';
  }
  try {
    await navigator.clipboard.writeText(url);
    return 'copied';
  } catch {
    return 'failed';
  }
};

const sendLink = async ({ url, title, text }: Params): Promise<HandoffResult> => {
  if (!canUseShare()) {
    return copyLink({ url });
  }
  try {
    await navigator.share({ url, title, text });
    return 'shared';
  } catch (error: unknown) {
    if (isAbort(error)) {
      return 'cancelled';
    }
  }
  return copyLink({ url });
};

const settledState = ({ result }: SettleParams): HandoffState => {
  if (result === 'shared' || result === 'copied') {
    return result;
  }
  return 'idle';
};

export const useHandoff = ({ url, title, text }: Params): Handoff => {
  const [state, setState] = useState<HandoffState>('idle');
  const [canShare] = useState(canUseShare);
  const latestRef = useRef(0);

  const handoff = useCallback(() => {
    latestRef.current += 1;
    const request = latestRef.current;
    void sendLink({ url, title, text }).then((result) => {
      if (latestRef.current !== request) {
        return;
      }
      setState(settledState({ result }));
    });
  }, [url, title, text]);

  return { state, canShare, handoff };
};
