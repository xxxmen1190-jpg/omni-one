/**
 * Omni One Web Intelligence Types
 * Types for web search, scraping, and real-world information retrieval
 */

/**
 * Web Search Types
 */

export interface SearchQuery {
  query: string;
  limit?: number;
  filters?: {
    language?: string;
    region?: string;
    timeRange?: "day" | "week" | "month" | "year";
    domain?: string;
  };
}

export interface SearchResult {
  id: string;
  title: string;
  url: string;
  snippet: string;
  source: string;
  timestamp?: number;
  relevanceScore: number;
  credibilityScore: number;
  language?: string;
}

export interface SearchResponse {
  query: string;
  results: SearchResult[];
  totalResults: number;
  executionTime: number;
  provider: string;
}

/**
 * Web Scraping Types
 */

export interface ScrapedContent {
  url: string;
  title: string;
  content: string;
  html?: string;
  metadata: {
    author?: string;
    publishDate?: string;
    description?: string;
    keywords?: string[];
    language?: string;
  };
  images?: Array<{
    src: string;
    alt?: string;
  }>;
  links?: Array<{
    href: string;
    text: string;
  }>;
  scrapedAt: number;
}

export interface ScrapingTask {
  id: string;
  url: string;
  status: "pending" | "scraping" | "completed" | "failed";
  content?: ScrapedContent;
  error?: string;
  startTime?: number;
  endTime?: number;
  duration?: number;
}

/**
 * Source Credibility Types
 */

export interface CredibilityMetrics {
  domainAge: number; // days
  isKnownSource: boolean;
  hasSSL: boolean;
  updateFrequency: "daily" | "weekly" | "monthly" | "rarely";
  authorityScore: number; // 0-100
  trustScore: number; // 0-100
  factCheckHistory?: Array<{
    claim: string;
    verified: boolean;
    timestamp: number;
  }>;
}

export interface SourceCredibility {
  domain: string;
  metrics: CredibilityMetrics;
  overallScore: number; // 0-100
  riskLevel: "low" | "medium" | "high";
  recommendation: "trusted" | "verify" | "avoid";
}

/**
 * Real-Time Information Types
 */

export interface RealtimeDataSource {
  id: string;
  name: string;
  type: "weather" | "news" | "crypto" | "stocks" | "sports" | "other";
  url?: string;
  apiKey?: string;
  updateFrequency: number; // seconds
  lastUpdated?: number;
}

export interface RealtimeData {
  source: string;
  type: string;
  data: Record<string, any>;
  timestamp: number;
  ttl: number; // seconds
}

/**
 * Web Agent Types
 */

export type WebAgentGoal =
  | "research"
  | "fact_check"
  | "summarize"
  | "compare"
  | "analyze_news"
  | "find_information";

export interface WebAgentTask {
  id: string;
  goal: WebAgentGoal;
  query: string;
  constraints?: {
    maxSources?: number;
    minCredibilityScore?: number;
    timeRange?: "day" | "week" | "month" | "year";
    languages?: string[];
  };
  status: "pending" | "searching" | "scraping" | "analyzing" | "completed" | "failed";
  startTime?: number;
  endTime?: number;
  duration?: number;
  error?: string;
}

export interface WebAgentResult {
  taskId: string;
  goal: WebAgentGoal;
  query: string;
  summary: string;
  findings: Array<{
    claim: string;
    evidence: string[];
    confidence: number;
    sources: string[];
  }>;
  sources: SearchResult[];
  credibilityAssessment: {
    overallScore: number;
    conflictingInfo?: string[];
    consensusInfo?: string[];
  };
  recommendations: string[];
  executionTime: number;
}

/**
 * Multi-Source Validation Types
 */

export interface SourceComparison {
  claim: string;
  sources: Array<{
    source: string;
    statement: string;
    credibilityScore: number;
    timestamp?: number;
  }>;
  consensus: boolean;
  conflictLevel: "none" | "minor" | "major";
  recommendation: string;
}

export interface ValidationResult {
  claim: string;
  isVerified: boolean;
  confidenceLevel: number; // 0-1
  supportingSources: string[];
  conflictingSources: string[];
  notes: string;
}

/**
 * News Types
 */

export interface NewsArticle {
  id: string;
  title: string;
  content: string;
  source: string;
  url: string;
  publishedAt: number;
  author?: string;
  category?: string;
  sentiment?: "positive" | "negative" | "neutral";
  importance?: number; // 0-100
  credibilityScore: number;
}

export interface NewsResponse {
  articles: NewsArticle[];
  totalResults: number;
  executionTime: number;
}

/**
 * Wikipedia Types
 */

export interface WikipediaPage {
  id: string;
  title: string;
  url: string;
  summary: string;
  content: string;
  sections: Array<{
    title: string;
    content: string;
  }>;
  images?: Array<{
    src: string;
    caption?: string;
  }>;
  references?: Array<{
    title: string;
    url: string;
  }>;
  lastModified: number;
}

/**
 * Web Intelligence Config
 */

export interface WebIntelligenceConfig {
  enableWebSearch: boolean;
  enableScraping: boolean;
  enableRealtime: boolean;
  enableNewsRetrieval: boolean;
  enableWikipedia: boolean;
  maxSearchResults: number;
  maxScrapingConcurrency: number;
  scrapingTimeout: number; // ms
  credibilityThreshold: number; // 0-1
  cacheResults: boolean;
  cacheTTL: number; // seconds
}

/**
 * Web Intelligence State
 */

export interface WebIntelligenceState {
  activeTasks: Map<string, WebAgentTask>;
  cachedResults: Map<string, SearchResponse | ScrapedContent | RealtimeData>;
  credibilityCache: Map<string, SourceCredibility>;
  statistics: {
    totalSearches: number;
    totalScrapings: number;
    averageSearchTime: number;
    averageScrapingTime: number;
    cacheHitRate: number;
    lastUpdated: number;
  };
}
