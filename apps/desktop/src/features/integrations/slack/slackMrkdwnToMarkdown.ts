type Params = {
  readonly text: string;
  readonly userNames?: ReadonlyMap<string, string>;
  readonly channelNames?: ReadonlyMap<string, string>;
};

const EMPTY_NAMES: ReadonlyMap<string, string> = new Map();

const CODE_PATTERN = /```[\s\S]*?```|`[^`\n]*`/g;
const PLACEHOLDER_PATTERN = /\u0000(\d+)\u0000/g;
const ENTITY_PATTERN = /<([^<>\n]*)>/g;
const BOLD_PATTERN = /\*([^*\n]+)\*/g;
const STRIKE_PATTERN = /~([^~\n]+)~/g;
const ESCAPE_PATTERN = /&(amp|lt|gt);/g;

const HTML_ENTITIES: Readonly<Record<string, string>> = {
  amp: '&',
  lt: '<',
  gt: '>',
};

type EntityParams = {
  readonly body: string;
  readonly userNames: ReadonlyMap<string, string>;
  readonly channelNames: ReadonlyMap<string, string>;
};

type PrefixedParams = {
  readonly body: string;
  readonly names: ReadonlyMap<string, string>;
  readonly sigil: string;
};

const renderPrefixed = ({ body, names, sigil }: PrefixedParams): string => {
  const [rawId, label] = body.slice(1).split('|');
  const id = rawId ?? '';
  const resolved = names.get(id);
  if (resolved != null && resolved !== '') {
    return `${sigil}${resolved}`;
  }
  if (label != null && label !== '') {
    return `${sigil}${label}`;
  }
  return `${sigil}${id}`;
};

type CommandParams = {
  readonly body: string;
};

const renderCommand = ({ body }: CommandParams): string => {
  const [rawCommand, label] = body.slice(1).split('|');
  if (label != null && label !== '') {
    return label.startsWith('@') ? label : `@${label}`;
  }
  const command = (rawCommand ?? '').split('^')[0] ?? '';
  return `@${command}`;
};

type LinkParams = {
  readonly body: string;
};

const renderLink = ({ body }: LinkParams): string => {
  const separator = body.indexOf('|');
  if (separator < 0) {
    return `[${body}](${body})`;
  }
  const url = body.slice(0, separator);
  const label = body.slice(separator + 1);
  if (label === '') {
    return `[${url}](${url})`;
  }
  return `[${label}](${url})`;
};

const renderEntity = ({ body, userNames, channelNames }: EntityParams): string => {
  if (body.startsWith('@')) {
    return renderPrefixed({ body, names: userNames, sigil: '@' });
  }
  if (body.startsWith('#')) {
    return renderPrefixed({ body, names: channelNames, sigil: '#' });
  }
  if (body.startsWith('!')) {
    return renderCommand({ body });
  }
  return renderLink({ body });
};

export const slackMrkdwnToMarkdown = ({
  text,
  userNames = EMPTY_NAMES,
  channelNames = EMPTY_NAMES,
}: Params): string => {
  if (text === '') {
    return '';
  }

  const fragments: string[] = [];
  const masked = text.replace(CODE_PATTERN, (fragment: string) => {
    fragments.push(fragment);
    return `\u0000${fragments.length - 1}\u0000`;
  });

  const linked = masked.replace(ENTITY_PATTERN, (whole: string, body: string) => {
    if (body === '') {
      return whole;
    }
    return renderEntity({ body, userNames, channelNames });
  });

  const formatted = linked.replace(BOLD_PATTERN, '**$1**').replace(STRIKE_PATTERN, '~~$1~~');

  const restored = formatted.replace(
    PLACEHOLDER_PATTERN,
    (whole: string, index: string) => fragments[Number(index)] ?? whole,
  );

  return restored.replace(ESCAPE_PATTERN, (whole: string, name: string) => {
    return HTML_ENTITIES[name] ?? whole;
  });
};
