export type SettingWords = Readonly<{
  value: string;
  source: string;
  chain: string;
  spentText?: string;
  isChanged?: boolean;
  isFromWorkspace?: boolean;
}>;
