import { Tooltip } from '@goodboy/ui';
import { CONCEPT_ICONS, ICON_SIZE } from '../../../../../shared/components/conceptIcons';
import { ProviderGlyph } from '../../../../../shared/components/RoutingPicker/ProviderGlyph';
import type { PresetStepMark } from '../../../presetStepMarksOf';

type Props = {
  readonly marks: ReadonlyArray<PresetStepMark>;
};

export const PresetStepMarks = ({ marks }: Props) => (
  <Tooltip
    content={
      <span className="flex flex-col">
        {marks.map((mark) => (
          <span key={mark.key}>{mark.label}</span>
        ))}
      </span>
    }
  >
    <span data-preset-step-marks="" className="flex items-center gap-1">
      {marks.map((mark) =>
        mark.provider === null ? (
          <CONCEPT_ICONS.autoRouting
            key={mark.key}
            data-step-mark="auto"
            size={ICON_SIZE.row}
            aria-hidden
            className="shrink-0 text-muted-foreground"
          />
        ) : (
          <span key={mark.key} data-step-mark={mark.provider} className="inline-flex shrink-0">
            <ProviderGlyph id={mark.provider} size={ICON_SIZE.row} />
          </span>
        ),
      )}
      <span className="sr-only">{marks.map((mark) => mark.label).join(', ')}</span>
    </span>
  </Tooltip>
);
