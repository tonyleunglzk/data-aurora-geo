export interface ProductInfo {
  brand: string;
  name: string;
  type: string;
  specs: string;
  sellingPoints: string[];
  sellingPointsRange: string;
  targetAudience: string;
  emphasis: string[];
  emphasisRange: string;
  keyword: string;
  keywordMode: string;
  seoKeywords: string[];
  brandPool: string[];
  brandPoolCount: string;
}

export interface GeoRuleCardPromptContext {
  category: string;
  rawSummary: string;
  titlePatterns: string[];
  leadPatterns: string[];
  sectionBlueprint: string[];
  keywordPlacement: string[];
  sellingPointOrder: string[];
  trustSignals: string[];
  endingPatterns: string[];
  antiPatterns: string[];
  rankingHypotheses: string[];
}
