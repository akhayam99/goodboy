import { Select } from '@goodboy/ui';
import type { WireframeScreen } from '@goodboy/core';

type Props = {
  readonly screens: ReadonlyArray<WireframeScreen>;
  readonly currentScreenId: string;
  readonly onSelect: (screenId: string) => void;
};

export const WireframeScreenSelect = ({ screens, currentScreenId, onSelect }: Props) => {
  const order = screens.findIndex((screen) => screen.id === currentScreenId);
  return (
    <span className="flex min-w-0 items-center gap-2">
      <Select
        size="sm"
        aria-label="Screen"
        data-testid="wireframe-screen-select"
        value={currentScreenId}
        onChange={(event) => onSelect(event.target.value)}
        className="max-w-60 truncate"
      >
        {screens.map((screen) => (
          <option key={screen.id} value={screen.id}>
            {screen.title}
          </option>
        ))}
      </Select>
      <span className="shrink-0 text-secondary tabular-nums text-muted-foreground">
        {`${order + 1}/${screens.length}`}
      </span>
    </span>
  );
};
