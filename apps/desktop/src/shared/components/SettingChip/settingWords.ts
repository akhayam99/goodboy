export type SettingWords = Readonly<{
  value: string;
  source: string;
  chain: string;
  fact?: string;
  isChanged?: boolean;
  isFromWorkspace?: boolean;
}>;
