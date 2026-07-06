import { NewsArticle, NewsResponse } from "../../types/webIntelligence";
import { Logger } from "../system/Logger";

/**
 * News Tool - Retrieves news articles from multiple sources
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

      const articles = await this.fetchNews(query, limit);

      const response: NewsResponse = {
        articles,
        totalResults: articles.length,
        executionTime: 300, // Placeholder
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
   * Fetch news articles
   */
  private async fetchNews(query: string, limit: number): Promise<NewsArticle[]> {
    // Mock news articles
    const mockArticles: NewsArticle[] = [
      {
        id: "1",
        title: `Breaking: Latest news about ${query}`,
        content: `This is the latest news about ${query}. Important developments have been reported...`,
        source: "NewsSource1",
        url: `https://news1.com/article/${query}`,
        publishedAt: Date.now(),
        author: "Reporter Name",
        category: "Technology",
        sentiment: "neutral",
        importance: 95,
        credibilityScore: 0.9,
      },
      {
        id: "2",
        title: `Update: ${query} developments`,
        content: `New updates on ${query} have emerged. Here's what you need to know...`,
        source: "NewsSource2",
        url: `https://news2.com/article/${query}`,
        publishedAt: Date.now() - 3600000,
        author: "Another Reporter",
        category: "News",
        sentiment: "positive",
        importance: 85,
        credibilityScore: 0.88,
      },
      {
        id: "3",
        title: `Analysis: ${query} impact`,
        content: `Analysis of how ${query} will impact various sectors...`,
        source: "NewsSource3",
        url: `https://news3.com/article/${query}`,
        publishedAt: Date.now() - 7200000,
        author: "Analyst",
        category: "Analysis",
        sentiment: "neutral",
        importance: 75,
        credibilityScore: 0.85,
      },
    ];

    return mockArticles.slice(0, limit);
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
