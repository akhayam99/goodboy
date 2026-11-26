type Params = {
  readonly line: string;
};

const LOCAL_LIVE_PATTERN =
  /\b(?:gblocal:[/][/]localhost|https?:[/][/]gblocal\.localhost)[/][0-9a-f-]+[/]/gi;

export const withoutGrantOf = ({ line }: Params): string =>
  line.replace(LOCAL_LIVE_PATTERN, 'file:///');
