import { Listbox } from '@goodboy/ui';
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
      <Listbox
        size="sm"
        ariaLabel="Screen"
        testId="wireframe-screen-select"
        value={currentScreenId}
        options={screens.map((screen) => ({ value: screen.id, label: screen.title }))}
        onChange={onSelect}
        className="max-w-60"
      />
      <span className="shrink-0 text-secondary tabular-nums text-muted-foreground">
        {`${order + 1}/${screens.length}`}
      </span>
    </span>
  );
};
