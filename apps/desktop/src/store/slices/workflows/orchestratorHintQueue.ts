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
  'Everything the operator told you during this run, oldest first. Each hint lives for the whole run: judge from its wording whether it still applies. A newer hint wins over an older one it contradicts. When a hint carries images, open and look at them, then write into the step brief what they show and exactly what to change, so the step never depends on seeing them.';

type HintParams = {
  readonly hint: OrchestratorHint;
  readonly paths: ReadonlyArray<string>;
};

type FormatParams = HintsParams & {
  readonly imagePaths?: Readonly<Record<string, ReadonlyArray<string>>>;
};

const CONTINUATION = '  ';

const imagesLine = ({ hint, paths }: HintParams): ReadonlyArray<string> => {
  const count = hint.attachmentIds?.length ?? 0;
  if (count === 0) {
    return [];
  }
  const label = count === 1 ? '1 image is' : `${count} images are`;
  if (paths.length === 0) {
    return [`(${label} attached to this hint but could not be found on disk.)`];
  }
  return [
    `(${label} attached to this hint. Open each with your Read tool:)`,
    ...paths.map((path) => `- ${path}`),
  ];
};

const formatHint = ({ hint, paths }: HintParams): string => {
  const marker = hint.consumedAtStep == null ? '- [new]' : `- [since step ${hint.consumedAtStep}]`;
  const [first = '', ...rest] = hint.text.split(/\r?\n/);
  const continuation = [...rest, ...imagesLine({ hint, paths })].map((line) =>
    line.trim() === '' ? '' : `${CONTINUATION}${line}`,
  );
  return [`${marker} ${first}`, ...continuation].join('\n');
};

export const formatOrchestratorHints = ({ hints, imagePaths = {} }: FormatParams): string => {
  if (hints.length === 0) {
    return '';
  }
  return [
    HINTS_HEADER,
    ...hints.map((hint) => formatHint({ hint, paths: imagePaths[hint.id] ?? [] })),
  ].join('\n');
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
