import {
  SearchQuery,
  SearchResult,
  SearchResponse,
} from "../../types/webIntelligence";
import { Logger } from "../system/Logger";

/**
 * Web Search Tool — Real Production Implementation (Phase 12.9)
 * Primary:  Brave Search API (BRAVE_SEARCH_API_KEY)
 * Fallback: SerpAPI (SERPAPI_KEY)
 * Fallback: DuckDuckGo Instant Answer API (free, no key)
 */

export class WebSearchTool {
  private cache: Map<string, { result: SearchResponse; timestamp: number }> = new Map();
  private cacheTTL: number = 3600000; // 1 hour
  private maxCacheSize: number = 100;

  constructor() {
    Logger.info("WebSearchTool initialized");
  }

  /**
   * Search the web
   */
  async search(query: SearchQuery): Promise<SearchResponse> {
    const cacheKey = this.generateCacheKey(query);

    // Check cache
    const cached = this.cache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < this.cacheTTL) {
      Logger.debug("Search cache hit", { query: query.query });
      return cached.result;
    }

    try {
      const startTime = Date.now();
      Logger.info("Searching web (real)", { query: query.query, limit: query.limit || 10 });

      const results = await this.performSearch(query);

      const response: SearchResponse = {
        query: query.query,
        results,
        totalResults: results.length,
        executionTime: Date.now() - startTime,
        provider: results.length > 0 ? (this.getEnv("BRAVE_SEARCH_API_KEY") ? "brave" : this.getEnv("SERPAPI_KEY") ? "serpapi" : "duckduckgo") : "none",
      };

      // Cache result
      this.cache.set(cacheKey, {
        result: response,
        timestamp: Date.now(),
      });

      // Cleanup old cache
      if (this.cache.size > this.maxCacheSize) {
        const oldest = Array.from(this.cache.entries()).sort(
          (a, b) => a[1].timestamp - b[1].timestamp
        )[0];
        this.cache.delete(oldest[0]);
      }

      return response;
    } catch (error: any) {
      Logger.error("Web search failed", {
        query: query.query,
        error: error.message,
      });

      throw error;
    }
  }

  /**
   * Perform real web search with provider cascade.
   */
  private async performSearch(query: SearchQuery): Promise<SearchResult[]> {
    // ── Brave Search API ────────────────────────────────────────────────────
    const braveKey = this.getEnv("BRAVE_SEARCH_API_KEY");
    if (braveKey) {
      try {
        return await this.searchBrave(query, braveKey);
      } catch (err) {
        Logger.warn("Brave Search failed, falling back", { err: (err as Error).message });
      }
    }

    // ── SerpAPI ─────────────────────────────────────────────────────────────
    const serpKey = this.getEnv("SERPAPI_KEY");
    if (serpKey) {
      try {
        return await this.searchSerpAPI(query, serpKey);
      } catch (err) {
        Logger.warn("SerpAPI failed, falling back to DuckDuckGo", { err: (err as Error).message });
      }
    }

    // ── DuckDuckGo Instant Answer API (free, no key required) ───────────────
    return this.searchDuckDuckGo(query);
  }

  private async searchBrave(query: SearchQuery, apiKey: string): Promise<SearchResult[]> {
    const params = new URLSearchParams({
      q: query.query,
      count: String(query.limit ?? 10),
      ...(query.filters?.language ? { lang: query.filters.language } : {}),
      ...(query.filters?.region ? { country: query.filters.region } : {}),
    });
    const res = await fetch(`https://api.search.brave.com/res/v1/web/search?${params}`, {
      headers: { Accept: "application/json", "Accept-Encoding": "gzip", "X-Subscription-Token": apiKey },
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) throw new Error(`Brave HTTP ${res.status}`);
    const data = await res.json();
    return (data.web?.results ?? []).map((r: any, i: number) => ({
      id: `brave-${i}`,
      title: r.title ?? "",
      url: r.url ?? "",
      snippet: r.description ?? "",
      source: (() => { try { return new URL(r.url).hostname; } catch { return r.url; } })(),
      timestamp: r.page_age ? new Date(r.page_age).getTime() : Date.now(),
      relevanceScore: Math.max(0.1, 1 - i * 0.05),
      credibilityScore: 0.85,
      language: query.filters?.language ?? "en",
    }));
  }

  private async searchSerpAPI(query: SearchQuery, apiKey: string): Promise<SearchResult[]> {
    const params = new URLSearchParams({ q: query.query, num: String(query.limit ?? 10), api_key: apiKey, engine: "google" });
    const res = await fetch(`https://serpapi.com/search.json?${params}`, { signal: AbortSignal.timeout(15000) });
    if (!res.ok) throw new Error(`SerpAPI HTTP ${res.status}`);
    const data = await res.json();
    return (data.organic_results ?? []).map((r: any, i: number) => ({
      id: `serp-${i}`,
      title: r.title ?? "",
      url: r.link ?? "",
      snippet: r.snippet ?? "",
      source: (() => { try { return new URL(r.link).hostname; } catch { return r.link; } })(),
      timestamp: Date.now(),
      relevanceScore: Math.max(0.1, 1 - i * 0.05),
      credibilityScore: 0.88,
      language: query.filters?.language ?? "en",
    }));
  }

  private async searchDuckDuckGo(query: SearchQuery): Promise<SearchResult[]> {
    const params = new URLSearchParams({ q: query.query, format: "json", no_html: "1", skip_disambig: "1" });
    const res = await fetch(`https://api.duckduckgo.com/?${params}`, {
      headers: { "User-Agent": "omni-one/1.0" },
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) throw new Error(`DuckDuckGo HTTP ${res.status}`);
    const data = await res.json();
    const results: SearchResult[] = [];
    let idx = 0;
    if (data.AbstractText && data.AbstractURL) {
      results.push({ id: "ddg-abstract", title: data.Heading ?? query.query, url: data.AbstractURL, snippet: data.AbstractText, source: data.AbstractSource ?? "", timestamp: Date.now(), relevanceScore: 1.0, credibilityScore: 0.9, language: "en" });
      idx++;
    }
    for (const topic of [...(data.RelatedTopics ?? [])]) {
      if (idx >= (query.limit ?? 10)) break;
      const items = topic.Topics ? topic.Topics : [topic];
      for (const item of items) {
        if (idx >= (query.limit ?? 10)) break;
        if (item.FirstURL && item.Text) {
          results.push({ id: `ddg-${idx}`, title: item.Text.split(" - ")[0] ?? item.Text, url: item.FirstURL, snippet: item.Text, source: (() => { try { return new URL(item.FirstURL).hostname; } catch { return ""; } })(), timestamp: Date.now(), relevanceScore: Math.max(0.1, 0.8 - idx * 0.05), credibilityScore: 0.75, language: "en" });
          idx++;
        }
      }
    }
    return results;
  }

  private getEnv(key: string): string | undefined {
    return typeof process !== "undefined" ? process.env[key] : undefined;
  }

  /**
   * Search with filters
   */
  async searchWithFilters(query: string, filters: any = {}): Promise<SearchResponse> {
    return this.search({
      query,
      limit: filters.limit || 10,
      filters,
    });
  }

  /**
   * Get search suggestions via DuckDuckGo autocomplete.
   */
  async getSuggestions(query: string): Promise<string[]> {
    try {
      const res = await fetch(`https://duckduckgo.com/ac/?q=${encodeURIComponent(query)}&type=list`, {
        headers: { "User-Agent": "omni-one/1.0" },
        signal: AbortSignal.timeout(5000),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      // DuckDuckGo returns [query, [suggestions]]
      return Array.isArray(data[1]) ? data[1].slice(0, 8) : [];
    } catch {
      return [`${query} news`, `${query} wikipedia`, `${query} tutorial`, `${query} guide`];
    }
  }

  /**
   * Generate cache key
   */
  private generateCacheKey(query: SearchQuery): string {
    const filterStr = query.filters
      ? JSON.stringify(query.filters)
      : "";
    return `${query.query}:${query.limit || 10}:${filterStr}`;
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    this.cache.clear();
    Logger.info("Search cache cleared");
  }

  /**
   * Get cache statistics
   */
  getCacheStatistics(): Record<string, any> {
    return {
      cacheSize: this.cache.size,
      maxCacheSize: this.maxCacheSize,
      cacheTTL: this.cacheTTL,
    };
  }
}

export const createWebSearchTool = (): WebSearchTool => {
  return new WebSearchTool();
};
