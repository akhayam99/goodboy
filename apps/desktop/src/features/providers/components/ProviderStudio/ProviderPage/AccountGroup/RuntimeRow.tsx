import { useState } from 'react';
import { BAND_ROW_CLASS, Button, cn } from '@goodboy/ui';
import type { ProviderDisplayInfo } from '../../../../providers';
import { useAppStore } from '../../../../../../store';

export const RuntimeRow = ({ info }: { readonly info: ProviderDisplayInfo }) => {
  const refreshProviders = useAppStore((state) => state.refreshProviders);
  const [isDetecting, setIsDetecting] = useState(false);
  const isReady =
    info.connection !== 'missing' && info.connection !== 'error' && info.connection !== 'unknown';
  const detect = async () => {
    setIsDetecting(true);
    try {
      await refreshProviders();
    } finally {
      setIsDetecting(false);
    }
  };
  return (
    <div className={cn(BAND_ROW_CLASS, 'gap-3 text-label')}>
      <span className="w-28 shrink-0 text-muted-foreground">Runtime</span>
      <span className="min-w-0 flex-1 truncate text-foreground">
        {isReady
          ? `OpenCode ${info.version ?? ''}`.trim()
          : 'OpenCode is required. Install it, then detect it again.'}
      </span>
      <Button variant="ghost" size="sm" isBusy={isDetecting} onClick={() => void detect()}>
        Detect
      </Button>
    </div>
  );
};
