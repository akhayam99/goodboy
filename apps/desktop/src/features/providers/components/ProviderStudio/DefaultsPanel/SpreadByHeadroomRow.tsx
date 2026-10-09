import type { WorkspaceId } from '@goodboy/types';
import { Switch } from '@goodboy/ui';
import { useSpreadByHeadroom } from '../../../hooks/useSpreadByHeadroom';

type Props = {
  readonly workspaceId: WorkspaceId;
};

export const SpreadByHeadroomRow = ({ workspaceId }: Props) => {
  const { canSpread, isOn, sentence, setSpread } = useSpreadByHeadroom({ workspaceId });
  return (
    <div className="flex flex-col gap-0.5 px-1">
      <Switch
        label="Send new steps to the provider with the most room"
        checked={isOn}
        disabled={!canSpread}
        onChange={setSpread}
        className="self-start"
      />
      <span
        data-testid="spread-sentence"
        aria-live="polite"
        className="px-2 text-meta text-muted-foreground"
      >
        {sentence}
      </span>
    </div>
  );
};
