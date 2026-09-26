import type { Agent, SessionArtifact } from '@goodboy/types';
import { reportSourceName } from './reportSourceName';

export type ReportSourceLink =
  | Readonly<{ kind: 'agent'; id: string; label: string }>
  | Readonly<{ kind: 'artifact'; id: string; label: string }>;

export type ReportSourceLinkParams = Readonly<{
  sourceText: string;
  agents: ReadonlyArray<Agent>;
  artifacts: ReadonlyArray<SessionArtifact>;
  excludeArtifactId: string;
}>;

type Candidate = Readonly<{
  link: ReportSourceLink;
  citation: string;
}>;

type NeedlePatternParams = Readonly<{
  needle: string;
}>;

type CitedByNameParams = Readonly<{
  sourceText: string;
  candidates: ReadonlyArray<Candidate>;
}>;

type NameClaim = Readonly<{
  text: string;
  cited: ReadonlySet<Candidate>;
}>;

const WORD_EDGE = '[\\p{L}\\p{N}_-]';
const MASK = '\u0000';

const needlePattern = ({ needle }: NeedlePatternParams): RegExp =>
  new RegExp(
    `(?<!${WORD_EDGE})${needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?!${WORD_EDGE})`,
    'gu',
  );

const citedByName = ({ sourceText, candidates }: CitedByNameParams): ReadonlySet<Candidate> => {
  const lengths = [...new Set(candidates.map((candidate) => candidate.citation.length))].sort(
    (left, right) => right - left,
  );
  const claim = lengths.reduce<NameClaim>(
    (current, length) => {
      const hits = candidates
        .filter((candidate) => candidate.citation.length === length)
        .map((candidate) => ({
          candidate,
          starts: [...current.text.matchAll(needlePattern({ needle: candidate.citation }))].map(
            (match) => match.index,
          ),
        }))
        .filter((hit) => hit.starts.length > 0);
      const text = hits
        .flatMap((hit) => hit.starts)
        .reduce(
          (masked, start) =>
            `${masked.slice(0, start)}${MASK.repeat(length)}${masked.slice(start + length)}`,
          current.text,
        );
      return { text, cited: new Set([...current.cited, ...hits.map((hit) => hit.candidate)]) };
    },
    { text: sourceText, cited: new Set<Candidate>() },
  );
  return claim.cited;
};

export const collectReportSourceLinks = ({
  sourceText,
  agents,
  artifacts,
  excludeArtifactId,
}: ReportSourceLinkParams): ReadonlyArray<ReportSourceLink> => {
  const agentCandidates: ReadonlyArray<Candidate> = agents.map((agent) => ({
    link: { kind: 'agent', id: agent.id, label: agent.name },
    citation: reportSourceName({ source: { kind: 'agent', agent } }),
  }));
  const artifactCandidates: ReadonlyArray<Candidate> = artifacts
    .filter((artifact) => artifact.id !== excludeArtifactId)
    .map((artifact) => ({
      link: { kind: 'artifact', id: artifact.id, label: artifact.title },
      citation: reportSourceName({ source: { kind: 'artifact', artifact } }),
    }));
  const candidates = [...agentCandidates, ...artifactCandidates];
  const named = citedByName({ sourceText, candidates });
  return candidates
    .filter(
      (candidate) =>
        named.has(candidate) || needlePattern({ needle: candidate.link.id }).test(sourceText),
    )
    .map((candidate) => candidate.link);
};
