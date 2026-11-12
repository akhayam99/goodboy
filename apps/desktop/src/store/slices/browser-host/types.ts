export type StartLoadParams = {
  readonly tabId: string;
  readonly url: string;
  readonly startedAt: number;
};

export type FinishLoadParams = {
  readonly tabId: string;
  readonly url: string;
};

export type ExpireLoadParams = {
  readonly tabId: string;
  readonly startedAt: number;
};

export type ForgetLoadParams = {
  readonly tabId: string;
};

export type SetFaviconParams = {
  readonly origin: string;
  readonly src: string | null;
};
