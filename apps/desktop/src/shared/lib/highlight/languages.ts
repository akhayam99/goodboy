import type { LanguageInput } from 'shiki/core';

export type SyntaxLang =
  | 'typescript'
  | 'tsx'
  | 'javascript'
  | 'jsx'
  | 'json'
  | 'jsonc'
  | 'css'
  | 'scss'
  | 'less'
  | 'html'
  | 'xml'
  | 'markdown'
  | 'yaml'
  | 'toml'
  | 'rust'
  | 'go'
  | 'python'
  | 'ruby'
  | 'java'
  | 'kotlin'
  | 'swift'
  | 'c'
  | 'cpp'
  | 'csharp'
  | 'php'
  | 'sql'
  | 'shellscript'
  | 'dockerfile'
  | 'graphql'
  | 'vue'
  | 'svelte'
  | 'diff'
  | 'ini'
  | 'make';

export const LANGUAGE_LOADERS: Record<SyntaxLang, LanguageInput> = {
  typescript: () => import('shiki/langs/typescript.mjs'),
  tsx: () => import('shiki/langs/tsx.mjs'),
  javascript: () => import('shiki/langs/javascript.mjs'),
  jsx: () => import('shiki/langs/jsx.mjs'),
  json: () => import('shiki/langs/json.mjs'),
  jsonc: () => import('shiki/langs/jsonc.mjs'),
  css: () => import('shiki/langs/css.mjs'),
  scss: () => import('shiki/langs/scss.mjs'),
  less: () => import('shiki/langs/less.mjs'),
  html: () => import('shiki/langs/html.mjs'),
  xml: () => import('shiki/langs/xml.mjs'),
  markdown: () => import('shiki/langs/markdown.mjs'),
  yaml: () => import('shiki/langs/yaml.mjs'),
  toml: () => import('shiki/langs/toml.mjs'),
  rust: () => import('shiki/langs/rust.mjs'),
  go: () => import('shiki/langs/go.mjs'),
  python: () => import('shiki/langs/python.mjs'),
  ruby: () => import('shiki/langs/ruby.mjs'),
  java: () => import('shiki/langs/java.mjs'),
  kotlin: () => import('shiki/langs/kotlin.mjs'),
  swift: () => import('shiki/langs/swift.mjs'),
  c: () => import('shiki/langs/c.mjs'),
  cpp: () => import('shiki/langs/cpp.mjs'),
  csharp: () => import('shiki/langs/csharp.mjs'),
  php: () => import('shiki/langs/php.mjs'),
  sql: () => import('shiki/langs/sql.mjs'),
  shellscript: () => import('shiki/langs/shellscript.mjs'),
  dockerfile: () => import('shiki/langs/dockerfile.mjs'),
  graphql: () => import('shiki/langs/graphql.mjs'),
  vue: () => import('shiki/langs/vue.mjs'),
  svelte: () => import('shiki/langs/svelte.mjs'),
  diff: () => import('shiki/langs/diff.mjs'),
  ini: () => import('shiki/langs/ini.mjs'),
  make: () => import('shiki/langs/make.mjs'),
};

const ALIASES: Record<string, SyntaxLang> = {
  ts: 'typescript',
  mts: 'typescript',
  cts: 'typescript',
  typescript: 'typescript',
  tsx: 'tsx',
  js: 'javascript',
  mjs: 'javascript',
  cjs: 'javascript',
  javascript: 'javascript',
  jsx: 'jsx',
  json: 'json',
  json5: 'jsonc',
  jsonc: 'jsonc',
  css: 'css',
  scss: 'scss',
  sass: 'scss',
  less: 'less',
  html: 'html',
  htm: 'html',
  xml: 'xml',
  svg: 'xml',
  plist: 'xml',
  md: 'markdown',
  mdx: 'markdown',
  markdown: 'markdown',
  yml: 'yaml',
  yaml: 'yaml',
  toml: 'toml',
  rs: 'rust',
  rust: 'rust',
  go: 'go',
  golang: 'go',
  py: 'python',
  python: 'python',
  rb: 'ruby',
  ruby: 'ruby',
  java: 'java',
  kt: 'kotlin',
  kts: 'kotlin',
  kotlin: 'kotlin',
  swift: 'swift',
  c: 'c',
  h: 'c',
  cc: 'cpp',
  cpp: 'cpp',
  cxx: 'cpp',
  hpp: 'cpp',
  'c++': 'cpp',
  cs: 'csharp',
  csharp: 'csharp',
  php: 'php',
  sql: 'sql',
  sh: 'shellscript',
  bash: 'shellscript',
  zsh: 'shellscript',
  shell: 'shellscript',
  shellscript: 'shellscript',
  console: 'shellscript',
  dockerfile: 'dockerfile',
  docker: 'dockerfile',
  graphql: 'graphql',
  gql: 'graphql',
  vue: 'vue',
  svelte: 'svelte',
  diff: 'diff',
  patch: 'diff',
  ini: 'ini',
  cfg: 'ini',
  conf: 'ini',
  env: 'ini',
  makefile: 'make',
  make: 'make',
  mk: 'make',
};

export const languageForName = (name: string | null | undefined): SyntaxLang | null => {
  if (!name) {
    return null;
  }
  return ALIASES[name.trim().toLowerCase()] ?? null;
};

export const languageForPath = (path: string): SyntaxLang | null => {
  const base = path.slice(path.lastIndexOf('/') + 1).toLowerCase();
  if (base === 'dockerfile' || base.startsWith('dockerfile.')) {
    return 'dockerfile';
  }
  if (base === 'makefile' || base === 'gnumakefile') {
    return 'make';
  }
  if (base === '.env' || base.startsWith('.env.')) {
    return 'ini';
  }
  const dot = base.lastIndexOf('.');
  if (dot < 0) {
    return null;
  }
  return languageForName(base.slice(dot + 1));
};
