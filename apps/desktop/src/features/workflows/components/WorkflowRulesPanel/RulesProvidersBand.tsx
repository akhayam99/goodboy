import type { WorkspaceId } from '@goodboy/types';
import { Band, BandRow, Button, Switch } from '@goodboy/ui';
import { openSettings } from '../../../settings/openSettings';
import { useRulesProviders } from '../../hooks/useRulesProviders';
import { canSpreadByHeadroom, nextStepPick } from '../../rulesHeadroom';
import { spreadSentence } from './spreadSentence';

type Props = {
  readonly workspaceId: WorkspaceId;
  readonly spread: boolean;
  readonly onSpread: (spread: boolean) => void;
};

export const RulesProvidersBand = ({ workspaceId, spread, onSpread }: Props) => {
  const rooms = useRulesProviders({ workspaceId, isSpreadOn: spread });
  const canSpread = canSpreadByHeadroom({ rooms });
  const isSpreadOn = canSpread && spread;
  const pick = nextStepPick({ rooms, spread: isSpreadOn });
  return (
    <Band label="Providers" ariaLabel="Providers" headingLevel={3}>
      <BandRow>
        <span className="min-w-0 flex-1 text-row text-foreground">
          Use providers with room left
        </span>
        <Switch
          label={<span className="sr-only">Use providers with room left</span>}
          checked={isSpreadOn}
          disabled={!canSpread}
          onChange={onSpread}
        />
      </BandRow>
      <BandRow>
        <span
          data-testid="rules-spread-sentence"
          aria-live="polite"
          className="min-w-0 flex-1 text-meta text-muted-foreground"
        >
          {spreadSentence({ canSpread, spread: isSpreadOn, pick })}
        </span>
        <Button variant="ghost" size="sm" onClick={() => openSettings({ scope: 'providers' })}>
          Open Models
        </Button>
      </BandRow>
    </Band>
  );
};
