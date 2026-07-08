import { NewsArticle, NewsResponse } from "../../types/webIntelligence";
import { Logger } from "../system/Logger";

/**
 * News Tool — Real Production Implementation (Phase 12.9)
 * Primary:  NewsAPI.org (NEWS_API_KEY)
 * Fallback: GNews API (GNEWS_API_KEY)
 * Fallback: HackerNews Algolia API (free, no key)
 */

export class NewsTool {
  private cache: Map<string, { response: NewsResponse; timestamp: number }> = new Map();
  private cacheTTL: number = 3600000; // 1 hour
  private maxCacheSize: number = 50;

  constructor() {
    Logger.info("NewsTool initialized");
  }

  /**
   * Search news
   */
  async searchNews(query: string, limit: number = 10): Promise<NewsResponse> {
    const cacheKey = `news:${query}:${limit}`;

    // Check cache
    const cached = this.cache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < this.cacheTTL) {
      Logger.debug("News cache hit", { query });
      return cached.response;
    }

    try {
      Logger.info("Searching news", { query, limit });

      const startTime = Date.now();
      const articles = await this.fetchNews(query, limit);

      const response: NewsResponse = {
        articles,
        totalResults: articles.length,
        executionTime: Date.now() - startTime,
      };

      // Cache result
      this.cache.set(cacheKey, {
        response,
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
      Logger.error("News search failed", {
        query,
        error: error.message,
      });

      throw error;
    }
  }

  /**
   * Fetch news articles using real APIs.
   * Phase 12.9: Replaced mock with real API calls.
   */
  private async fetchNews(query: string, limit: number): Promise<NewsArticle[]> {
    // ── NewsAPI.org ───────────────────────────────────────────────────────────────────
    const newsApiKey = this.getEnv("NEWS_API_KEY");
    if (newsApiKey) {
      try {
        const params = new URLSearchParams({ q: query, pageSize: String(limit), apiKey: newsApiKey, language: "en", sortBy: "publishedAt" });
        const res = await fetch(`https://newsapi.org/v2/everything?${params}`, { signal: AbortSignal.timeout(10000) });
        if (res.ok) {
          const data = await res.json();
          if (data.articles?.length > 0) {
            return data.articles.slice(0, limit).map((a: any, i: number) => ({
              id: `newsapi-${i}`,
              title: a.title ?? "",
              content: a.content ?? a.description ?? "",
              source: a.source?.name ?? "",
              url: a.url ?? "",
              publishedAt: a.publishedAt ? new Date(a.publishedAt).getTime() : Date.now(),
              author: a.author ?? undefined,
              category: "News",
              sentiment: "neutral" as const,
              importance: Math.max(10, 100 - i * 5),
              credibilityScore: 0.85,
              imageUrl: a.urlToImage ?? undefined,
            }));
          }
        }
      } catch (err) {
        Logger.warn("NewsAPI failed, trying GNews", { err: (err as Error).message });
      }
    }

    // ── GNews API ───────────────────────────────────────────────────────────────────
    const gnewsKey = this.getEnv("GNEWS_API_KEY");
    if (gnewsKey) {
      try {
        const params = new URLSearchParams({ q: query, max: String(limit), apikey: gnewsKey, lang: "en" });
        const res = await fetch(`https://gnews.io/api/v4/search?${params}`, { signal: AbortSignal.timeout(10000) });
        if (res.ok) {
          const data = await res.json();
          if (data.articles?.length > 0) {
            return data.articles.slice(0, limit).map((a: any, i: number) => ({
              id: `gnews-${i}`,
              title: a.title ?? "",
              content: a.content ?? a.description ?? "",
              source: a.source?.name ?? "",
              url: a.url ?? "",
              publishedAt: a.publishedAt ? new Date(a.publishedAt).getTime() : Date.now(),
              author: undefined,
              category: "News",
              sentiment: "neutral" as const,
              importance: Math.max(10, 100 - i * 5),
              credibilityScore: 0.8,
              imageUrl: a.image ?? undefined,
            }));
          }
        }
      } catch (err) {
        Logger.warn("GNews failed, trying HackerNews", { err: (err as Error).message });
      }
    }

    // ── HackerNews Algolia API (free, no key) ──────────────────────────────────
    const params = new URLSearchParams({ query, tags: "story", hitsPerPage: String(limit) });
    const res = await fetch(`https://hn.algolia.com/api/v1/search?${params}`, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) throw new Error(`HackerNews HTTP ${res.status}`);
    const data = await res.json();
    return (data.hits ?? []).slice(0, limit).map((h: any, i: number) => ({
      id: `hn-${h.objectID ?? i}`,
      title: h.title ?? "",
      content: h.story_text ?? h.comment_text ?? "",
      source: "Hacker News",
      url: h.url ?? `https://news.ycombinator.com/item?id=${h.objectID}`,
      publishedAt: h.created_at_i ? h.created_at_i * 1000 : Date.now(),
      author: h.author ?? undefined,
      category: "Technology",
      sentiment: "neutral" as const,
      importance: Math.max(10, Math.min(100, (h.points ?? 0) / 10)),
      credibilityScore: 0.75,
    }));
  }

  private getEnv(key: string): string | undefined {
    return typeof process !== "undefined" ? process.env[key] : undefined;
  }

  /**
   * Get trending news
   */
  async getTrendingNews(limit: number = 10): Promise<NewsArticle[]> {
    const articles = await this.fetchNews("trending", limit);
    return articles;
  }

  /**
   * Get news by category
   */
  async getNewsByCategory(category: string, limit: number = 10): Promise<NewsArticle[]> {
    const articles = await this.fetchNews(category, limit);
    return articles.filter((a) => a.category?.toLowerCase() === category.toLowerCase());
  }

  /**
   * Get news by source
   */
  async getNewsBySource(source: string, limit: number = 10): Promise<NewsArticle[]> {
    const articles = await this.fetchNews(source, limit);
    return articles.filter((a) => a.source.toLowerCase() === source.toLowerCase());
  }

  /**
   * Analyze sentiment
   */
  async analyzeSentiment(articles: NewsArticle[]): Promise<Record<string, any>> {
    const sentiments = {
      positive: articles.filter((a) => a.sentiment === "positive").length,
      negative: articles.filter((a) => a.sentiment === "negative").length,
      neutral: articles.filter((a) => a.sentiment === "neutral").length,
    };

    return {
      ...sentiments,
      total: articles.length,
      overallSentiment:
        sentiments.positive > sentiments.negative ? "positive" : "negative",
    };
  }

  /**
   * Get top stories
   */
  async getTopStories(limit: number = 5): Promise<NewsArticle[]> {
    const articles = await this.fetchNews("top stories", limit * 2);
    return articles
      .sort((a, b) => (b.importance || 0) - (a.importance || 0))
      .slice(0, limit);
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    this.cache.clear();
    Logger.info("News cache cleared");
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

export const createNewsTool = (): NewsTool => {
  return new NewsTool();
};
