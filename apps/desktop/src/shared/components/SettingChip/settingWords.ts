export type SettingWords = Readonly<{
  value: string;
  source: string;
  chain: string;
  isChanged?: boolean;
  isFromWorkspace?: boolean;
}>;
