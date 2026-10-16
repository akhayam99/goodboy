import { SegmentedTabs } from '@goodboy/ui';
import { startSentence } from '../../startSentence';
import type { ArtifactChoiceOption } from '../../artifactCreationAdapter';

type Props = {
  readonly ariaLabel: string;
  readonly options: ReadonlyArray<ArtifactChoiceOption>;
  readonly value: string;
  readonly onChange: (value: string) => void;
};

type HintParams = {
  readonly hint: string;
};

const SENTENCE_END = '. ';

const firstSentenceOf = ({ hint }: HintParams): string => {
  const sentence = startSentence({ text: hint });
  const end = sentence.indexOf(SENTENCE_END);
  return end === -1 ? sentence : sentence.slice(0, end + 1);
};

export const ArtifactChoiceRows = ({ ariaLabel, options, value, onChange }: Props) => {
  const selected = options.find((option) => option.value === value) ?? options[0] ?? null;
  const hint = selected?.hint ?? null;

  return (
    <div className="flex min-w-0 flex-col gap-2">
      <SegmentedTabs
        ariaLabel={ariaLabel}
        options={options.map((option) => ({ value: option.value, label: option.label }))}
        value={selected?.value ?? value}
        onChange={onChange}
        className="self-start"
      />
      {hint === null ? null : (
        <span data-testid="artifact-choice-hint" className="text-meta text-muted-foreground">
          {firstSentenceOf({ hint })}
        </span>
      )}
    </div>
  );
};
