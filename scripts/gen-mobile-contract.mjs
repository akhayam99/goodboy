import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const ROOT_DIRECTORY = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const CONTRACT_DIRECTORY = 'apps/desktop/src/features/companion/contract';
const STYLES_PATH = 'apps/desktop/src/styles.css';
const LOCK_FILE = 'contract.lock.json';
const VERSION_FILE = 'contractVersion.ts';
const SKIPPED_FILES = new Set([VERSION_FILE]);
const SWIFT_KEYWORDS = new Set([
  'associatedtype',
  'class',
  'default',
  'deinit',
  'enum',
  'extension',
  'func',
  'import',
  'in',
  'init',
  'inout',
  'internal',
  'let',
  'operator',
  'private',
  'protocol',
  'public',
  'return',
  'self',
  'static',
  'struct',
  'subscript',
  'switch',
  'throw',
  'try',
  'var',
  'where',
  'case',
  'for',
  'if',
  'is',
  'as',
  'do',
  'true',
  'false',
  'nil',
  'repeat',
  'while',
]);
const SWIFT_PRIMITIVES = new Map([
  ['string', 'String'],
  ['number', 'Double'],
  ['boolean', 'Bool'],
]);
const SWIFT_INT_ALIAS = 'Int';

const camelOf = ({ text }) =>
  text.replace(/[-_ ]+([a-zA-Z0-9])/g, (_match, letter) => letter.toUpperCase());

const swiftNameOf = ({ text }) => {
  const name = camelOf({ text });
  return SWIFT_KEYWORDS.has(name) ? `\`${name}\`` : name;
};

const sha256Of = ({ text }) => createHash('sha256').update(text).digest('hex');

const versionOf = ({ root }) => {
  const source = readFileSync(join(root, CONTRACT_DIRECTORY, VERSION_FILE), 'utf8');
  const match = /CONTRACT_VERSION\s*=\s*(\d+)/.exec(source);
  if (match === null) {
    throw new Error(`${VERSION_FILE} does not declare CONTRACT_VERSION`);
  }
  return Number(match[1]);
};

const parseAliases = ({ root }) => {
  const directory = join(root, CONTRACT_DIRECTORY);
  const names = readdirSync(directory)
    .filter(
      (name) => name.endsWith('.ts') && !name.endsWith('.test.ts') && !SKIPPED_FILES.has(name),
    )
    .sort();
  const aliases = new Map();
  for (const name of names) {
    const source = ts.createSourceFile(
      name,
      readFileSync(join(directory, name), 'utf8'),
      ts.ScriptTarget.ES2022,
      true,
    );
    for (const statement of source.statements) {
      if (ts.isTypeAliasDeclaration(statement)) {
        aliases.set(statement.name.text, {
          name: statement.name.text,
          file: name,
          node: statement.type,
        });
      }
    }
  }
  return aliases;
};

const unsupported = ({ node, why }) => {
  const { line } = node.getSourceFile().getLineAndCharacterOfPosition(node.getStart());
  throw new Error(`contract: ${why} at ${node.getSourceFile().fileName}:${line + 1}`);
};

const isNullNode = ({ node }) =>
  ts.isLiteralTypeNode(node) && node.literal.kind === ts.SyntaxKind.NullKeyword;

const isStringLiteralNode = ({ node }) =>
  ts.isLiteralTypeNode(node) && ts.isStringLiteral(node.literal);

const stripReadonly = ({ node }) =>
  ts.isTypeOperatorNode(node) && node.operator === ts.SyntaxKind.ReadonlyKeyword ? node.type : node;

const typeReferenceName = ({ node }) => (ts.isIdentifier(node.typeName) ? node.typeName.text : '');

const fieldTypeOf = ({ aliases, node: rawNode }) => {
  const node = stripReadonly({ node: rawNode });
  if (node.kind === ts.SyntaxKind.StringKeyword) {
    return { swift: 'String', isOptional: false };
  }
  if (node.kind === ts.SyntaxKind.NumberKeyword) {
    return { swift: 'Double', isOptional: false };
  }
  if (node.kind === ts.SyntaxKind.BooleanKeyword) {
    return { swift: 'Bool', isOptional: false };
  }
  if (ts.isArrayTypeNode(node)) {
    return {
      swift: `[${fieldTypeOf({ aliases, node: node.elementType }).swift}]`,
      isOptional: false,
    };
  }
  if (ts.isTypeReferenceNode(node)) {
    const name = typeReferenceName({ node });
    const args = node.typeArguments ?? [];
    if ((name === 'ReadonlyArray' || name === 'Array') && args.length === 1) {
      return { swift: `[${fieldTypeOf({ aliases, node: args[0] }).swift}]`, isOptional: false };
    }
    if (name === 'Record' && args.length === 2) {
      return {
        swift: `[String: ${fieldTypeOf({ aliases, node: args[1] }).swift}]`,
        isOptional: false,
      };
    }
    if (!aliases.has(name)) {
      return unsupported({ node, why: `unknown type reference ${name}` });
    }
    return { swift: name, isOptional: false };
  }
  if (ts.isUnionTypeNode(node)) {
    const rest = node.types.filter((member) => !isNullNode({ node: member }));
    if (rest.length === 1 && rest.length < node.types.length) {
      return { swift: fieldTypeOf({ aliases, node: rest[0] }).swift, isOptional: true };
    }
    return unsupported({ node, why: 'inline unions are only allowed as T | null' });
  }
  return unsupported({ node, why: `unsupported field type ${ts.SyntaxKind[node.kind]}` });
};

const membersOfLiteral = ({ aliases, node }) =>
  node.members.map((member) => {
    if (!ts.isPropertySignature(member) || member.type === undefined) {
      return unsupported({ node: member, why: 'only typed properties are allowed' });
    }
    const name = ts.isIdentifier(member.name) ? member.name.text : null;
    if (name === null) {
      return unsupported({ node: member, why: 'property names must be identifiers' });
    }
    const type = member.type;
    if (isStringLiteralNode({ node: type })) {
      return { name, literal: type.literal.text, swift: 'String', isOptional: false };
    }
    const field = fieldTypeOf({ aliases, node: type });
    return {
      name,
      literal: null,
      swift: field.swift,
      isOptional: field.isOptional || member.questionToken !== undefined,
    };
  });

const objectFieldsOf = ({ aliases, node: rawNode }) => {
  const node = stripReadonly({ node: rawNode });
  if (ts.isTypeLiteralNode(node)) {
    return membersOfLiteral({ aliases, node });
  }
  if (ts.isIntersectionTypeNode(node)) {
    return node.types.flatMap((member) => objectFieldsOf({ aliases, node: member }));
  }
  if (ts.isTypeReferenceNode(node)) {
    const target = aliases.get(typeReferenceName({ node }));
    if (target === undefined) {
      return unsupported({ node, why: 'unknown type reference in object' });
    }
    return objectFieldsOf({ aliases, node: target.node });
  }
  return unsupported({ node, why: 'expected an object type' });
};

const isObjectNode = ({ aliases, node: rawNode }) => {
  const node = stripReadonly({ node: rawNode });
  if (ts.isTypeLiteralNode(node)) {
    return true;
  }
  if (ts.isIntersectionTypeNode(node)) {
    return node.types.every((member) => isObjectNode({ aliases, node: member }));
  }
  if (ts.isTypeReferenceNode(node)) {
    const target = aliases.get(typeReferenceName({ node }));
    return target !== undefined && isObjectNode({ aliases, node: target.node });
  }
  return false;
};

const classify = ({ aliases, alias }) => {
  const node = stripReadonly({ node: alias.node });
  if (isStringLiteralNode({ node })) {
    return { type: 'enum', cases: [node.literal.text] };
  }
  if (ts.isUnionTypeNode(node)) {
    if (node.types.every((member) => isStringLiteralNode({ node: member }))) {
      return { type: 'enum', cases: node.types.map((member) => member.literal.text) };
    }
    if (
      node.types.every(
        (member) => ts.isTypeReferenceNode(member) && isObjectNode({ aliases, node: member }),
      )
    ) {
      return {
        type: 'tagged',
        members: node.types.map((member) => typeReferenceName({ node: member })),
      };
    }
    return { type: 'alias', field: fieldTypeOf({ aliases, node }) };
  }
  if (isObjectNode({ aliases, node })) {
    return { type: 'struct', fields: objectFieldsOf({ aliases, node }) };
  }
  return { type: 'alias', field: fieldTypeOf({ aliases, node }) };
};

const typeOfField = ({ field }) => (field.isOptional ? `${field.swift}?` : field.swift);

const emitEnum = ({ name, cases }) => {
  const lines = cases.map((value) => `    case ${swiftNameOf({ text: value })} = "${value}"`);
  return [
    `public enum ${name}: String, Codable, Sendable, Equatable, CaseIterable {`,
    ...lines,
    '}',
  ].join('\n');
};

const emitStruct = ({ name, fields }) => {
  const shown = fields.filter((field) => field.literal === null);
  const properties = shown.map(
    (field) => `    public let ${swiftNameOf({ text: field.name })}: ${typeOfField({ field })}`,
  );
  const params = shown.map(
    (field) => `${swiftNameOf({ text: field.name })}: ${typeOfField({ field })}`,
  );
  const assigns = shown.map(
    (field) =>
      `        self.${swiftNameOf({ text: field.name })} = ${swiftNameOf({ text: field.name })}`,
  );
  const initLines =
    shown.length === 0
      ? ['    public init() {}']
      : [`    public init(${params.join(', ')}) {`, ...assigns, '    }'];
  return [
    `public struct ${name}: Codable, Sendable, Equatable {`,
    ...properties,
    ...initLines,
    '}',
  ].join('\n');
};

const kindOf = ({ aliases, member }) => {
  const field = objectFieldsOf({ aliases, node: aliases.get(member).node }).find(
    (entry) => entry.name === 'kind',
  );
  if (field === undefined || field.literal === null) {
    throw new Error(`contract: ${member} has no literal kind to tag a union`);
  }
  return field.literal;
};

const emitTagged = ({ aliases, name, members }) => {
  const entries = members.map((member) => ({
    member,
    kind: kindOf({ aliases, member }),
  }));
  const cases = entries.map(
    ({ member, kind }) => `    case ${swiftNameOf({ text: kind })}(${member})`,
  );
  const decodes = entries.map(
    ({ member, kind }) =>
      `        case "${kind}": self = .${swiftNameOf({ text: kind })}(try ${member}(from: decoder))`,
  );
  const encodes = entries.map(
    ({ kind }) =>
      `        case .${swiftNameOf({ text: kind })}(let value):\n            try container.encode("${kind}", forKey: .kind)\n            try value.encode(to: encoder)`,
  );
  return [
    `public enum ${name}: Codable, Sendable, Equatable {`,
    ...cases,
    '    private enum CodingKeys: String, CodingKey { case kind }',
    '    public init(from decoder: Decoder) throws {',
    '        let container = try decoder.container(keyedBy: CodingKeys.self)',
    '        let kind = try container.decode(String.self, forKey: .kind)',
    '        switch kind {',
    ...decodes,
    '        default:',
    `            throw DecodingError.dataCorruptedError(forKey: .kind, in: container, debugDescription: "unknown ${name} kind \\(kind)")`,
    '        }',
    '    }',
    '    public func encode(to encoder: Encoder) throws {',
    '        var container = encoder.container(keyedBy: CodingKeys.self)',
    '        switch self {',
    ...encodes,
    '        }',
    '    }',
    '}',
  ].join('\n');
};

export const swiftOf = ({ root }) => {
  const aliases = parseAliases({ root });
  const blocks = [];
  for (const alias of aliases.values()) {
    const shape = classify({ aliases, alias });
    if (shape.type === 'alias') {
      const isInt = alias.name === SWIFT_INT_ALIAS;
      if (isInt) {
        continue;
      }
      blocks.push(`public typealias ${alias.name} = ${typeOfField({ field: shape.field })}`);
      continue;
    }
    if (shape.type === 'enum') {
      blocks.push(emitEnum({ name: alias.name, cases: shape.cases }));
      continue;
    }
    if (shape.type === 'struct') {
      blocks.push(emitStruct({ name: alias.name, fields: shape.fields }));
      continue;
    }
    blocks.push(emitTagged({ aliases, name: alias.name, members: shape.members }));
  }
  return `import Foundation\n\n${blocks.join('\n\n')}\n`;
};

const braceBlockOf = ({ css, selector }) => {
  const start = css.indexOf(`\n${selector} {`);
  if (start === -1) {
    throw new Error(`styles.css has no block for ${selector}`);
  }
  const open = css.indexOf('{', start);
  let depth = 0;
  for (let index = open; index < css.length; index += 1) {
    if (css[index] === '{') {
      depth += 1;
    }
    if (css[index] === '}') {
      depth -= 1;
    }
    if (depth === 0) {
      return css.slice(open + 1, index);
    }
  }
  throw new Error(`styles.css block for ${selector} does not close`);
};

const COLOR_DECLARATION = /^\s*(--color-[a-z0-9-]+)\s*:\s*([^;]+);/gm;

const declarationsOf = ({ block }) => {
  const declared = new Map();
  for (const match of block.matchAll(COLOR_DECLARATION)) {
    declared.set(match[1], match[2].trim());
  }
  return declared;
};

const resolveVars = ({ values }) => {
  const resolved = new Map();
  const resolveOne = ({ name, trail }) => {
    const known = resolved.get(name);
    if (known !== undefined) {
      return known;
    }
    const raw = values.get(name);
    if (raw === undefined || trail.includes(name)) {
      throw new Error(`token ${name} cannot be resolved`);
    }
    const reference = /^var\((--color-[a-z0-9-]+)\)$/.exec(raw);
    const value =
      reference === null ? raw : resolveOne({ name: reference[1], trail: [...trail, name] });
    resolved.set(name, value);
    return value;
  };
  for (const name of values.keys()) {
    resolveOne({ name, trail: [] });
  }
  return resolved;
};

const linearOf = ({ channel }) =>
  channel <= 0.0031308 ? 12.92 * channel : 1.055 * channel ** (1 / 2.4) - 0.055;

const roundOf = ({ value }) => Math.round(value * 10000) / 10000;

const clampOf = ({ value }) => Math.min(1, Math.max(0, value));

const srgbOfOklch = ({ lightness, chroma, hue, alpha }) => {
  const radians = (hue * Math.PI) / 180;
  const a = chroma * Math.cos(radians);
  const b = chroma * Math.sin(radians);
  const l = (lightness + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (lightness - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (lightness - 0.0894841775 * a - 1.291485548 * b) ** 3;
  const red = 4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s;
  const green = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s;
  const blue = -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s;
  return {
    red: roundOf({ value: clampOf({ value: linearOf({ channel: red }) }) }),
    green: roundOf({ value: clampOf({ value: linearOf({ channel: green }) }) }),
    blue: roundOf({ value: clampOf({ value: linearOf({ channel: blue }) }) }),
    alpha,
  };
};

const srgbOf = ({ value }) => {
  if (value === 'transparent') {
    return { red: 0, green: 0, blue: 0, alpha: 0 };
  }
  const oklch = /^oklch\(\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)\s*(?:\/\s*([\d.]+))?\s*\)$/.exec(value);
  if (oklch !== null) {
    return srgbOfOklch({
      lightness: Number(oklch[1]),
      chroma: Number(oklch[2]),
      hue: Number(oklch[3]),
      alpha: oklch[4] === undefined ? 1 : Number(oklch[4]),
    });
  }
  const hex = /^#([0-9a-f]{6})$/i.exec(value);
  if (hex !== null) {
    const channel = ({ from }) =>
      roundOf({ value: parseInt(hex[1].slice(from, from + 2), 16) / 255 });
    return {
      red: channel({ from: 0 }),
      green: channel({ from: 2 }),
      blue: channel({ from: 4 }),
      alpha: 1,
    };
  }
  throw new Error(`color value not understood: ${value}`);
};

const paletteOf = ({ resolved }) => {
  const palette = {};
  for (const name of [...resolved.keys()].sort()) {
    const value = resolved.get(name);
    palette[name.replace(/^--color-/, '')] = { css: value, srgb: srgbOf({ value }) };
  }
  return palette;
};

export const tokensOf = ({ root }) => {
  const css = readFileSync(join(root, STYLES_PATH), 'utf8');
  const dark = declarationsOf({ block: braceBlockOf({ css, selector: '@theme' }) });
  const light = declarationsOf({
    block: braceBlockOf({ css, selector: "html[data-theme='light']" }),
  });
  const darkMore = declarationsOf({
    block: braceBlockOf({ css, selector: "html[data-contrast='more']" }),
  });
  const lightMore = declarationsOf({
    block: braceBlockOf({ css, selector: "html[data-theme='light'][data-contrast='more']" }),
  });
  const declaredTotal = [...css.matchAll(COLOR_DECLARATION)].length;
  const parsedTotal = dark.size + light.size + darkMore.size + lightMore.size;
  if (declaredTotal !== parsedTotal) {
    throw new Error(
      `styles.css declares ${declaredTotal} color tokens but the four theme blocks hold ${parsedTotal}`,
    );
  }
  const darkValues = new Map(dark);
  const lightValues = new Map([...darkValues, ...light]);
  const darkMoreValues = new Map([...darkValues, ...darkMore]);
  const lightMoreValues = new Map([...lightValues, ...darkMore, ...lightMore]);
  return {
    dark: paletteOf({ resolved: resolveVars({ values: darkValues }) }),
    light: paletteOf({ resolved: resolveVars({ values: lightValues }) }),
    darkIncreasedContrast: paletteOf({ resolved: resolveVars({ values: darkMoreValues }) }),
    lightIncreasedContrast: paletteOf({ resolved: resolveVars({ values: lightMoreValues }) }),
  };
};

export const buildContract = ({ root = ROOT_DIRECTORY } = {}) => {
  const version = versionOf({ root });
  const swift = swiftOf({ root });
  const tokens = `${JSON.stringify({ contractVersion: version, ...tokensOf({ root }) }, null, 2)}\n`;
  const files = { 'Contract.generated.swift': swift, 'tokens.json': tokens };
  const sha256 = sha256Of({
    text: Object.keys(files)
      .sort()
      .map((name) => `${name}\n${files[name]}`)
      .join('\n'),
  });
  const manifest = `${JSON.stringify({ contractVersion: version, sha256 }, null, 2)}\n`;
  return { version, sha256, files: { ...files, 'manifest.json': manifest } };
};

export const lockPathOf = ({ root = ROOT_DIRECTORY } = {}) =>
  join(root, CONTRACT_DIRECTORY, LOCK_FILE);

export const readLock = ({ root = ROOT_DIRECTORY } = {}) =>
  JSON.parse(readFileSync(lockPathOf({ root }), 'utf8'));

export const lockOf = ({ contract }) =>
  `${JSON.stringify({ version: contract.version, sha256: contract.sha256 }, null, 2)}\n`;

export const lockVerdictOf = ({ lock, contract }) => {
  if (lock.version === contract.version && lock.sha256 === contract.sha256) {
    return { isOk: true, message: '' };
  }
  if (lock.version === contract.version) {
    return {
      isOk: false,
      message: `the mobile contract changed but CONTRACT_VERSION is still ${contract.version}: bump it in contractVersion.ts, then run node scripts/gen-mobile-contract.mjs --lock`,
    };
  }
  return {
    isOk: false,
    message: `contract.lock.json is stale (lock ${lock.version}, contract ${contract.version}): run node scripts/gen-mobile-contract.mjs --lock`,
  };
};

const run = ({ args }) => {
  const contract = buildContract();
  if (args.includes('--lock')) {
    writeFileSync(lockPathOf(), lockOf({ contract }));
    console.log(`contract lock written: version ${contract.version}`);
    return;
  }
  const outputDirectory = args.find((arg) => !arg.startsWith('--'));
  if (outputDirectory === undefined) {
    console.error('usage: node scripts/gen-mobile-contract.mjs <output-folder> | --lock');
    process.exitCode = 1;
    return;
  }
  mkdirSync(resolve(outputDirectory), { recursive: true });
  for (const [name, text] of Object.entries(contract.files)) {
    writeFileSync(join(resolve(outputDirectory), name), text);
  }
  console.log(`contract version ${contract.version} written to ${resolve(outputDirectory)}`);
};

if (process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  run({ args: process.argv.slice(2) });
}
