import { useState } from 'react';
import { ArrowRight, Info } from 'lucide-react';
import type { WorkspaceId } from '@goodboy/types';
import { Band, BandRow, Button, Chip, Switch } from '@goodboy/ui';
import { ICON_SIZE } from '../../../../shared/components/conceptIcons';
import { openSettings } from '../../../settings/openSettings';
import { useRulesProviders } from '../../hooks/useRulesProviders';
import { nextStepPick, roomUsedText, spreadSuggestion } from '../../rulesHeadroom';
import { RulesProviderRoomRow } from './RulesProviderRoomRow';

type Props = {
  readonly workspaceId: WorkspaceId;
  readonly spread: boolean;
  readonly onSpread: (spread: boolean) => void;
};

export const RulesProvidersBand = ({ workspaceId, spread, onSpread }: Props) => {
  const { summary, rooms } = useRulesProviders({ workspaceId });
  const [isOpen, setIsOpen] = useState(false);
  const hot = rooms.filter(
    (room) => room.stateLabel !== 'Off' && (room.headroom === 'tight' || room.headroom === 'out'),
  );
  const pick = nextStepPick({ rooms, spread });
  const suggestion = spread ? null : spreadSuggestion({ rooms });
  return (
    <Band label="Providers" ariaLabel="Providers" headingLevel={2}>
      <BandRow>
        <span className="flex min-w-0 flex-1 flex-col">
          <span data-testid="rules-provider-summary" className="text-label text-foreground">
            {summary.text}
          </span>
          <span className="text-secondary text-muted-foreground">
            Order and states are set in Defaults. Rules only summarise them.
          </span>
        </span>
        {hot.map((room) => (
          <Chip
            key={room.id}
            tone={room.headroom === 'out' ? 'danger' : 'warning'}
            size="xs"
            label={`${room.name} ${roomUsedText(room)} used`}
          />
        ))}
        <Button
          variant="ghost"
          size="sm"
          aria-expanded={isOpen}
          onClick={() => setIsOpen((open) => !open)}
        >
          {isOpen ? 'Done' : 'Show'}
        </Button>
      </BandRow>
      {isOpen ? (
        <div className="flex flex-col gap-1">
          <ul aria-label="Providers and what they have left" className="flex flex-col">
            {rooms.map((room) => (
              <RulesProviderRoomRow key={room.id} room={room} />
            ))}
          </ul>
          <BandRow>
            <span className="min-w-0 flex-1 text-secondary text-muted-foreground">
              Order and states are edited in Defaults, in one place for every workflow and agent.
            </span>
            <Button variant="ghost" size="sm" onClick={() => openSettings({ scope: 'providers' })}>
              Open Defaults
            </Button>
          </BandRow>
        </div>
      ) : null}
      <BandRow>
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="text-label text-foreground">Spread by what I have left</span>
          <span className="text-secondary text-muted-foreground">
            Every automatic pick looks at each provider&apos;s 5h and weekly room.
          </span>
        </span>
        <Switch
          label={<span className="sr-only">Spread by what I have left</span>}
          checked={spread}
          onChange={onSpread}
        />
      </BandRow>
      {pick === null ? null : (
        <BandRow>
          <ArrowRight size={ICON_SIZE.row} aria-hidden className="shrink-0 text-muted-foreground" />
          <span data-testid="rules-next-pick" className="flex min-w-0 flex-1 flex-col">
            <span className="text-label text-foreground">
              A step with no pinned provider goes to {pick.name}
            </span>
            <span className="text-secondary text-muted-foreground">{pick.why}</span>
          </span>
        </BandRow>
      )}
      {suggestion === null ? null : (
        <BandRow>
          <Info size={ICON_SIZE.row} aria-hidden className="shrink-0 text-info" />
          <span className="min-w-0 flex-1 text-secondary text-muted-foreground">{suggestion}</span>
          <Button variant="ghost" size="sm" onClick={() => onSpread(true)}>
            Turn on
          </Button>
        </BandRow>
      )}
    </Band>
  );
};
