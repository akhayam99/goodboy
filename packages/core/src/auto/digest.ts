import {
  AUTO_DELIVERY_ARTIFACT_CHARS,
  AUTO_DELIVERY_ARTIFACTS_TOTAL_CHARS,
  AUTO_DIGEST_SETTLED_MAX,
  AUTO_DIGEST_TASK_CHARS,
} from './limits';

export type DigestQuestion = Readonly<{
  questionId: string;
  text: string;
}>;

export type DigestDelegation = Readonly<{
  id: string;
  role: string;
  state: string;
  outcome: string | null;
  task: string;
  createdAt: number;
  question: DigestQuestion | null;
}>;

export type StateDigestParams = Readonly<{
  delegations: ReadonlyArray<DigestDelegation>;
  nowMs: number;
}>;

type OneLineParams = {
  readonly text: string;
  readonly max: number;
};

const oneLine = ({ text, max }: OneLineParams): string => {
  const flat = text.replace(/\s+/g, ' ').trim();
  return flat.length > max ? `${flat.slice(0, max)}...` : flat;
};

type AgeParams = {
  readonly ms: number;
};

const ageLabel = ({ ms }: AgeParams): string => {
  const minutes = Math.max(0, Math.floor(ms / 60_000));
  if (minutes < 1) {
    return 'under a minute';
  }
  if (minutes < 120) {
    return `${minutes} min`;
  }
  return `${Math.floor(minutes / 60)} h`;
};

type OpenLineParams = {
  readonly delegation: DigestDelegation;
  readonly nowMs: number;
};

const openLine = ({ delegation, nowMs }: OpenLineParams): string => {
  const task = oneLine({ text: delegation.task, max: AUTO_DIGEST_TASK_CHARS });
  if (delegation.state === 'paused' && delegation.question !== null) {
    return `- ${delegation.id} ${delegation.role}, waiting for your answer (question ${delegation.question.questionId}): ${oneLine({ text: delegation.question.text, max: AUTO_DIGEST_TASK_CHARS })}`;
  }
  const age = ageLabel({ ms: nowMs - delegation.createdAt });
  return `- ${delegation.id} ${delegation.role}, ${delegation.state.replace('_', ' ')} for ${age}: ${task}`;
};

export const buildStateDigest = ({ delegations, nowMs }: StateDigestParams): string => {
  if (delegations.length === 0) {
    return 'STATE OF THIS CONVERSATION\nNo agent has been started yet.';
  }
  const open = delegations.filter((delegation) => delegation.state !== 'settled');
  const settled = delegations.filter((delegation) => delegation.state === 'settled');
  const shown = settled.slice(-AUTO_DIGEST_SETTLED_MAX);
  const lines = ['STATE OF THIS CONVERSATION'];
  lines.push(
    open.length === 0
      ? 'No agent is open.'
      : `Open agents:\n${open.map((delegation) => openLine({ delegation, nowMs })).join('\n')}`,
  );
  if (shown.length > 0) {
    const hidden = settled.length - shown.length;
    const list = shown
      .map((delegation) => `${delegation.id} ${delegation.role} ${delegation.outcome ?? 'settled'}`)
      .join('; ');
    lines.push(`Settled agents: ${list}${hidden > 0 ? `; ${hidden} earlier not shown` : ''}.`);
  }
  return lines.join('\n');
};

export type DeliveryArtifactBody = Readonly<{
  id: string;
  kind: string;
  title: string;
  revision: number;
  body: string;
}>;

export type ArtifactBodiesParams = Readonly<{
  artifacts: ReadonlyArray<DeliveryArtifactBody>;
}>;

export const buildArtifactBodiesBlock = ({ artifacts }: ArtifactBodiesParams): string => {
  if (artifacts.length === 0) {
    return '';
  }
  let used = 0;
  const blocks: string[] = [];
  for (const artifact of artifacts) {
    const room = Math.min(AUTO_DELIVERY_ARTIFACT_CHARS, AUTO_DELIVERY_ARTIFACTS_TOTAL_CHARS - used);
    const header = `ARTIFACT ${artifact.id} (${artifact.kind}) "${oneLine({ text: artifact.title, max: 160 })}" v${artifact.revision}`;
    if (room <= 0) {
      blocks.push(`${header}\n[text not shown: the room for artifacts in this message is used]`);
      continue;
    }
    const isCut = artifact.body.length > room;
    const text = isCut ? artifact.body.slice(0, room) : artifact.body;
    used += text.length;
    blocks.push(
      isCut
        ? `${header}\n${text}\n[cut: ${artifact.body.length - room} more characters]`
        : `${header}\n${text}`,
    );
  }
  return blocks.join('\n\n');
};
