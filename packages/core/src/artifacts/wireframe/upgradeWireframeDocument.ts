import { WIREFRAME_LIMITS, WIREFRAME_SCHEMA_VERSION } from './schema';

type RawRecord = Readonly<Record<string, unknown>>;

const isRecord = (value: unknown): value is RawRecord =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const toggleKeys = ({ value, into }: { readonly value: unknown; readonly into: Set<string> }) => {
  if (Array.isArray(value)) {
    value.forEach((entry) => toggleKeys({ value: entry, into }));
    return;
  }
  if (!isRecord(value)) {
    return;
  }
  const action = value['action'];
  if (isRecord(action) && action['type'] === 'toggle' && typeof action['stateKey'] === 'string') {
    into.add(action['stateKey']);
  }
  toggleKeys({ value: value['children'], into });
  toggleKeys({ value: value['items'], into });
};

const labelOf = ({ key }: { readonly key: string }): string => {
  const words = key
    .replace(/^is(?=[A-Z])/, '')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[-_]+/g, ' ')
    .trim()
    .toLowerCase();
  if (words.length === 0) {
    return key;
  }
  return `${words.charAt(0).toUpperCase()}${words.slice(1)}`;
};

const upgradeScreen = ({
  screen,
  declared,
}: {
  readonly screen: unknown;
  readonly declared: ReadonlySet<string>;
}): unknown => {
  if (!isRecord(screen) || screen['states'] !== undefined) {
    return screen;
  }
  const keys = new Set<string>();
  toggleKeys({ value: screen['root'], into: keys });
  const states = [...keys]
    .filter((key) => declared.has(key))
    .slice(0, WIREFRAME_LIMITS.maxStatesPerScreen);
  if (states.length === 0) {
    return screen;
  }
  return {
    ...screen,
    states: Object.fromEntries(states.map((key) => [key, { label: labelOf({ key }) }])),
  };
};

export const upgradeWireframeDocument = ({ value }: { readonly value: unknown }): unknown => {
  if (!isRecord(value) || value['version'] !== 1) {
    return value;
  }
  const mockState = isRecord(value['mockState']) ? value['mockState'] : {};
  const declared = new Set(Object.keys(mockState));
  const screens = Array.isArray(value['screens'])
    ? value['screens'].map((screen) => upgradeScreen({ screen, declared }))
    : value['screens'];
  const rest = Object.fromEntries(Object.entries(value).filter(([key]) => key !== 'mockState'));
  return { ...rest, version: WIREFRAME_SCHEMA_VERSION, screens };
};
