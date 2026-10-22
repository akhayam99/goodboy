import { useEffect, useMemo, useState } from 'react';
import { NextStackView } from '../../../../../features/session/central/next/NextStackView';
import { applyDocumentTheme } from '../../../../../shared/lib/theme';
import { SESSION_ID, seedResolveScene } from '../resolveSeed';
import { centralNextActionsFor, centralNextCards, type CentralNextMoment } from './centralNextSeed';

type Props = {
  readonly theme: 'dark' | 'light';
  readonly moment: CentralNextMoment;
  readonly width?: number;
};

const DEFAULT_WIDTH = 720;

export const CentralNextScene = ({ theme, moment, width = DEFAULT_WIDTH }: Props) => {
  const [isReady, setIsReady] = useState(false);
  const cards = useMemo(() => centralNextCards({ moment }), [moment]);
  useEffect(() => {
    applyDocumentTheme({ theme });
    seedResolveScene({ expandedThreadId: null });
    setIsReady(true);
  }, [theme]);
  if (!isReady) {
    return null;
  }
  return (
    <div data-shot className="p-6">
      <div data-central-column style={{ width }} className="max-w-full">
        <NextStackView sessionId={SESSION_ID} cards={cards} actionsFor={centralNextActionsFor} />
      </div>
    </div>
  );
};
