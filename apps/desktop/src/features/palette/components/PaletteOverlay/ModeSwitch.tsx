import { SegmentedTabs } from '@goodboy/ui';
import { shortcutGlyphs } from '../../../../shared/keyboard/registry';
import type { PaletteMode, PaletteModeId } from '../../paletteModeTypes';

type Props = {
  readonly modes: ReadonlyArray<PaletteMode>;
  readonly value: PaletteModeId;
  readonly onChange: (mode: PaletteModeId) => void;
};

export const ModeSwitch = ({ modes, value, onChange }: Props) => (
  <SegmentedTabs
    size="sm"
    ariaLabel="Palette mode"
    value={value}
    onChange={onChange}
    options={modes.map((mode) => ({
      value: mode.id,
      label: mode.label,
      badge: (
        <span className="text-chip text-faint-foreground">{shortcutGlyphs(mode.shortcut)}</span>
      ),
    }))}
  />
);
