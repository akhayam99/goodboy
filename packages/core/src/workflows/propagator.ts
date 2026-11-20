import {
  annotateFallbackStepOutputSummary,
  fallbackStepOutputMarker,
  previewStepOutputSummary,
} from '../summarizer/step-output';

const EARLIER_STEP_PREVIEW_LENGTH = 280;
const OLDER_STEP_PREVIEW_LENGTH = 120;
const OMISSION_MARKER = '...';
const NO_OUTPUT = '(no output captured)';

export type ChainCarryForwardStep = {
  readonly ordinal?: number | null;
  readonly name?: string | null;
  readonly outputSummary?: string | null;
};

type ChainParams = {
  readonly steps?: ReadonlyArray<ChainCarryForwardStep | null | undefined> | null;
};

type OlderStepPreviewParams = {
  readonly summary: string;
};

const olderStepPreview = ({ summary }: OlderStepPreviewParams): string => {
  const annotated = annotateFallbackStepOutputSummary({ summary });
  const marker = fallbackStepOutputMarker({ summary: annotated });
  const prefix = marker === null ? '' : `${marker} `;
  const body = marker === null ? annotated : annotated.slice(marker.length).trimStart();
  const firstLine = body.split(/\r?\n/, 1)[0] ?? '';
  const room = OLDER_STEP_PREVIEW_LENGTH - prefix.length;
  if (firstLine.length <= room) {
    return `${prefix}${firstLine}`;
  }
  return `${prefix}${firstLine.slice(0, Math.max(room - OMISSION_MARKER.length, 0))}${OMISSION_MARKER}`;
};

export const buildChainCarryForward = ({ steps }: ChainParams): string => {
  const orderedSteps = (steps ?? [])
    .filter((step): step is ChainCarryForwardStep => step != null)
    .map((step) => ({
      ordinal: typeof step.ordinal === 'number' && Number.isFinite(step.ordinal) ? step.ordinal : 0,
      name: typeof step.name === 'string' ? step.name.trim() : '',
      outputSummary: typeof step.outputSummary === 'string' ? step.outputSummary : '',
    }))
    .sort((left, right) => left.ordinal - right.ordinal);
  const immediateStep = orderedSteps.at(-1);
  if (immediateStep == null) {
    return '';
  }

  const immediateSummary = annotateFallbackStepOutputSummary({
    summary: immediateStep.outputSummary.trim(),
  });
  const lines = [
    '## workflow handoff',
    `### step ${immediateStep.ordinal} output: ${immediateStep.name}`,
    immediateSummary.length > 0 ? immediateSummary : NO_OUTPUT,
  ];
  if (orderedSteps.length === 1) {
    return lines.join('\n');
  }

  lines.push('### earlier steps');
  const earlierSteps = orderedSteps.slice(0, -1).reverse();
  earlierSteps.forEach((step, index) => {
    const summary = step.outputSummary.trim();
    if (summary.length === 0) {
      lines.push(`- step ${step.ordinal} ${step.name}: ${NO_OUTPUT}`);
      return;
    }
    const preview =
      index === 0
        ? previewStepOutputSummary({ summary, length: EARLIER_STEP_PREVIEW_LENGTH })
        : olderStepPreview({ summary });
    lines.push(`- step ${step.ordinal} ${step.name}: ${preview}`);
  });
  return lines.join('\n');
};
