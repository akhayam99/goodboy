import type { IsoDateTime, OrchestratorHint } from '@goodboy/types';

type HintsParams = {
  readonly hints: ReadonlyArray<OrchestratorHint>;
};

type ConsumeParams = HintsParams & {
  readonly readIds: ReadonlySet<string>;
  readonly consumedAt: IsoDateTime;
  readonly step: number;
};

const HINTS_HEADER =
  'Everything the operator told you during this run, oldest first. Each hint lives for the whole run: judge from its wording whether it still applies. A newer hint wins over an older one it contradicts.';

type HintParams = {
  readonly hint: OrchestratorHint;
};

const CONTINUATION = '  ';

const imagesLine = ({ hint }: HintParams): ReadonlyArray<string> => {
  const count = hint.attachmentIds?.length ?? 0;
  if (count === 0) {
    return [];
  }
  return [
    `(${count === 1 ? '1 image is' : `${count} images are`} attached to this hint. The next agent gets ${count === 1 ? 'it' : 'them'} with the run files.)`,
  ];
};

const formatHint = ({ hint }: HintParams): string => {
  const marker = hint.consumedAtStep == null ? '- [new]' : `- [since step ${hint.consumedAtStep}]`;
  const [first = '', ...rest] = hint.text.split(/\r?\n/);
  const continuation = [...rest, ...imagesLine({ hint })].map((line) =>
    line.trim() === '' ? '' : `${CONTINUATION}${line}`,
  );
  return [`${marker} ${first}`, ...continuation].join('\n');
};

export const formatOrchestratorHints = ({ hints }: HintsParams): string => {
  if (hints.length === 0) {
    return '';
  }
  return [HINTS_HEADER, ...hints.map((hint) => formatHint({ hint }))].join('\n');
};

export const consumeOrchestratorHints = ({
  hints,
  readIds,
  consumedAt,
  step,
}: ConsumeParams): ReadonlyArray<OrchestratorHint> =>
  hints.map((hint) =>
    readIds.has(hint.id) && hint.consumedAt == null
      ? { ...hint, consumedAt, consumedAtStep: step }
      : hint,
  );
