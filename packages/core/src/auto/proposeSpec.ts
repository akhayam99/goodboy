import { isRecord } from '@goodboy/types/helpers';
import { sha256Hex } from '../slug/sha256';
import { parseDelegateSpec, type DelegateSpecOutcome } from './delegateSpec';
import { parseAutoDelegationRole, type AutoDelegationRole } from './roles';

export type ProposeAlternative = Readonly<{
  label: string;
  role: AutoDelegationRole;
}>;

export type ProposeSpecOutcome =
  | Readonly<{
      kind: 'ok';
      children: Extract<DelegateSpecOutcome, { kind: 'ok' }>['children'];
      alternatives: ReadonlyArray<ProposeAlternative>;
      hash: string;
    }>
  | Extract<DelegateSpecOutcome, { kind: 'refused' }>;

type Params = Readonly<{
  text: string;
}>;

type RefuseParams = Readonly<{
  message: string;
}>;

const proposeRefusal = ({ message }: RefuseParams): ProposeSpecOutcome => ({
  kind: 'refused',
  code: 'spec_invalid',
  message,
  perChild: [],
});

export const parseProposeSpec = ({ text }: Params): ProposeSpecOutcome => {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return proposeRefusal({ message: 'a proposal needs a JSON object' });
  }
  if (!isRecord(parsed) || !isRecord(parsed['primary'])) {
    return proposeRefusal({ message: 'a proposal needs one primary child' });
  }
  const rawAlternatives = parsed['alternatives'] === undefined ? [] : parsed['alternatives'];
  if (!Array.isArray(rawAlternatives) || rawAlternatives.length > 2) {
    return proposeRefusal({ message: 'a proposal accepts at most two alternatives' });
  }
  const alternatives: ProposeAlternative[] = [];
  for (const raw of rawAlternatives) {
    if (!isRecord(raw)) {
      return proposeRefusal({ message: 'an alternative needs a label and a role' });
    }
    const label = raw['label'];
    const role = parseAutoDelegationRole({ role: raw['role'] });
    if (typeof label !== 'string' || label.trim() === '' || role === null) {
      return proposeRefusal({ message: 'an alternative needs a nonempty label and a known role' });
    }
    alternatives.push({ label: label.trim().slice(0, 1_000), role });
  }
  const primary = parsed['primary'];
  const outcome = parseDelegateSpec({
    text: JSON.stringify({ children: [{ ...primary, confirm: true }] }),
  });
  if (outcome.kind === 'refused') {
    return outcome;
  }
  return {
    ...outcome,
    alternatives,
    hash: sha256Hex(JSON.stringify(['propose', outcome.hash, alternatives])),
  };
};
