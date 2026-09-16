export const ARTIFACT_BRIEF_LIMITS = {
  chars: 2_000,
} as const;

export const ARTIFACT_BRIEF_COUNTER_FLOOR = Math.round(ARTIFACT_BRIEF_LIMITS.chars * 0.8);

export type ClippedBrief = Readonly<{
  text: string;
  isClipped: boolean;
}>;

type ClipParams = Readonly<{
  text: string;
}>;

export const clipBrief = ({ text }: ClipParams): ClippedBrief => {
  const trimmed = text.trim();
  if (trimmed.length <= ARTIFACT_BRIEF_LIMITS.chars) {
    return { text: trimmed, isClipped: false };
  }
  return { text: trimmed.slice(0, ARTIFACT_BRIEF_LIMITS.chars), isClipped: true };
};

export const formatBriefCount = ({ value }: { readonly value: number }): string =>
  value.toLocaleString('en-US');

export const ARTIFACT_BRIEF_CLIP_NOTE = `user request: brief cut at ${formatBriefCount({
  value: ARTIFACT_BRIEF_LIMITS.chars,
})} characters`;
