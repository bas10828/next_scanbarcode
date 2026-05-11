export type ExcelRow = (string | number | boolean | Date | null | undefined)[];

export type MatcherContext = {
  d: string;
  rawDetail: unknown;
  quantity: unknown;
  currentBuilding: string;
  inventoryData: ExcelRow[];
  buildingIndex: number;
  subItemIndex: number;
};

export type MatcherOutcome =
  | { type: "matched"; text: string; nextSubItemIndex: number }
  | { type: "category-no-inv" }
  | { type: "ignore" }
  | null;

export type Matcher = (ctx: MatcherContext) => MatcherOutcome;

export type ReportImage = {
  dataUrl: string;
  b64: string;
  w: number;
  h: number;
  name: string;
};
