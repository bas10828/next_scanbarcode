export type ExcelRow = (string | number | boolean | Date | null | undefined)[];

export type MatcherContext = {
  d: string;
  rawDetail: unknown;
  quantity: unknown;
  currentBuilding: string;
  // True when an inventory Location belongs to the current section.
  inBuilding: (location: unknown) => boolean;
  // Device rows only (header/title rows already removed), canonical COL order.
  inventoryData: ExcelRow[];
  // Lower-cased details of every row in the current section.
  siblingDetails: string[];
  buildingIndex: number;
  subItemIndex: number;
  // Total quantity the estimate lists for this device category in the section.
  limit?: number;
  // Device Names the user picked by hand for this category (overrides limit).
  only?: Set<string>;
  // Called with every candidate inventory row (used to build the picker).
  collect?: (rows: ExcelRow[]) => void;
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
