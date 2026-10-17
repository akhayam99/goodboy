export type ToolKind = 'command' | 'read' | 'edit' | 'search' | 'web' | 'plan' | 'other';

const KIND_BY_NAME: ReadonlyMap<string, ToolKind> = new Map<string, ToolKind>([
  ['bash', 'command'],
  ['shell', 'command'],
  ['local_shell', 'command'],
  ['exec_command', 'command'],
  ['run_terminal_cmd', 'command'],
  ['run_shell_command', 'command'],
  ['read', 'read'],
  ['read_file', 'read'],
  ['read_many_files', 'read'],
  ['view', 'read'],
  ['edit', 'edit'],
  ['multiedit', 'edit'],
  ['write', 'edit'],
  ['notebookedit', 'edit'],
  ['apply_patch', 'edit'],
  ['edit_file', 'edit'],
  ['write_file', 'edit'],
  ['search_replace', 'edit'],
  ['replace', 'edit'],
  ['grep', 'search'],
  ['glob', 'search'],
  ['ls', 'search'],
  ['list_dir', 'search'],
  ['list_directory', 'search'],
  ['grep_search', 'search'],
  ['file_search', 'search'],
  ['codebase_search', 'search'],
  ['search_file_content', 'search'],
  ['webfetch', 'web'],
  ['websearch', 'web'],
  ['web_fetch', 'web'],
  ['web_search', 'web'],
  ['google_web_search', 'web'],
  ['todowrite', 'plan'],
  ['todo_write', 'plan'],
  ['update_plan', 'plan'],
  ['write_todos', 'plan'],
]);

type Params = {
  readonly toolName: string;
};

export const toolKind = ({ toolName }: Params): ToolKind =>
  KIND_BY_NAME.get(toolName.toLowerCase()) ?? 'other';
