import type { ProjectOverrideFacts } from './projectOverrideFacts';

const FACT_LIMIT = 3;

type Params = {
  readonly entries: ReadonlyArray<ProjectOverrideFacts>;
};

type JoinParams = {
  readonly parts: ReadonlyArray<string>;
};

const joinParts = ({ parts }: JoinParams): string => {
  const last = parts.at(-1);
  if (last === undefined || parts.length === 1) {
    return last ?? '';
  }
  return `${parts.slice(0, -1).join(', ')} and ${last}`;
};

export const projectOverrideSentence = ({ entries }: Params): string => {
  const [only] = entries;
  const isSingle = entries.length === 1 && only !== undefined;
  const facts = entries.flatMap((entry) =>
    entry.facts.map((fact) => (isSingle ? fact : `${fact} in ${entry.name}`)),
  );
  const shown = facts.slice(0, FACT_LIMIT);
  const hidden = facts.length - shown.length;
  const list = joinParts({ parts: hidden > 0 ? [...shown, `${hidden} more`] : shown });
  if (isSingle) {
    return `It wins over this page when you work in it: ${list} in ${only.name}.`;
  }
  return `They win over this page when you work in them: ${list}.`;
};
