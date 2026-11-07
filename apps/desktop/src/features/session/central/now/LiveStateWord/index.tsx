import { stateWordMeaningOf } from '../../../../../shared/utils/stateWordMeaningOf';
import { StatusDot, OptionalTooltip, type Tone } from '@goodboy/ui';

type Props = {
  readonly tone: Tone;
  readonly word: string;
  readonly autoWord?: string;
  readonly isSectionState?: boolean;
};

export const LiveStateWord = ({ tone, word, autoWord, isSectionState = false }: Props) => {
  if (isSectionState) {
    return null;
  }
  return (
    <>
      <StatusDot tone={tone} size="sm" />
      <OptionalTooltip content={stateWordMeaningOf({ word })}>
        <span
          data-auto-word={autoWord}
          className="min-w-0 truncate whitespace-nowrap text-ui text-muted-foreground"
        >
          {word}
        </span>
      </OptionalTooltip>
    </>
  );
};
