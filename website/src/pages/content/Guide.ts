export type GuideLink = {
  readonly label: string;
  readonly href: string;
};

export type GuideStep = {
  readonly text: string;
  readonly command?: string;
};

export type GuideItem = {
  readonly id: string;
  readonly title: string;
  readonly paragraphs: readonly string[];
  readonly links: readonly GuideLink[];
};

export type GuideSection = {
  readonly id: string;
  readonly heading: string;
  readonly paragraphs: readonly string[];
  readonly steps?: readonly GuideStep[];
  readonly items?: readonly GuideItem[];
  readonly links?: readonly GuideLink[];
};

export type GuideQuestion = {
  readonly question: string;
  readonly answer: string;
};

export type GuideFaq = {
  readonly heading: string;
  readonly items: readonly GuideQuestion[];
};

export type GuideCta = {
  readonly heading: string;
  readonly lead: string;
};

export type Guide = {
  readonly path: string;
  readonly title: string;
  readonly navLabel: string;
  readonly description: string;
  readonly summary: string;
  readonly definition: string;
  readonly sections: readonly GuideSection[];
  readonly faq?: GuideFaq;
  readonly cta: GuideCta;
  readonly related: readonly string[];
};
