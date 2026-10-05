import { extractScribeText, type ExtractedScribeText } from '@goodboy/core';
import { mergeScribeOutput } from '../../store/slices/scribe/mergeScribeOutput';
import type { TranscriptItem } from '../chat/utils/transcript-items';

export type ScribeProposal = {
  readonly title: string | null;
  readonly body: string | null;
  readonly changelogEntry: string | null;
  readonly latestText: string;
  readonly kickoff: string | null;
};

const EMPTY: ExtractedScribeText = {
  prTitle: null,
  prBody: null,
  commitMessages: [],
  changelogEntry: null,
};

const hasPullRequestText = ({ output }: { readonly output: ExtractedScribeText }): boolean =>
  output.prTitle !== null || output.prBody !== null || output.changelogEntry !== null;

export const carriesPullRequestText = ({ text }: { readonly text: string }): boolean =>
  hasPullRequestText({ output: extractScribeText(text) });

export const scribeProposalOf = ({
  items,
}: {
  readonly items: ReadonlyArray<TranscriptItem>;
}): ScribeProposal | null => {
  let merged = EMPTY;
  let latestText: string | null = null;
  let kickoff: string | null = null;
  for (const item of items) {
    if (kickoff === null && (item.kind === 'user_text' || item.kind === 'handoff')) {
      kickoff = item.text;
    }
    if (item.kind !== 'assistant_text') {
      continue;
    }
    const output = extractScribeText(item.text);
    if (!hasPullRequestText({ output })) {
      continue;
    }
    merged = mergeScribeOutput({ previous: merged, next: output });
    latestText = item.text;
  }
  if (latestText === null) {
    return null;
  }
  return {
    title: merged.prTitle,
    body: merged.prBody,
    changelogEntry: merged.changelogEntry,
    latestText,
    kickoff,
  };
};
