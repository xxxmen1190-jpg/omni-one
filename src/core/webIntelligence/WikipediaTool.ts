import { WikipediaPage } from "../../types/webIntelligence";
import { Logger } from "../system/Logger";

/**
 * Wikipedia Tool - Retrieves information from Wikipedia
 */

export class WikipediaTool {
  private cache: Map<string, { page: WikipediaPage; timestamp: number }> = new Map();
  private cacheTTL: number = 86400000; // 24 hours
  private maxCacheSize: number = 200;

  constructor() {
    Logger.info("WikipediaTool initialized");
  }

  /**
   * Search Wikipedia
   */
  async search(query: string): Promise<WikipediaPage | null> {
    const cacheKey = `wiki:${query.toLowerCase()}`;

    // Check cache
    const cached = this.cache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < this.cacheTTL) {
      Logger.debug("Wikipedia cache hit", { query });
      return cached.page;
    }

    try {
      Logger.info("Searching Wikipedia", { query });

      // In production, would call Wikipedia API
      const page = await this.fetchPage(query);

      if (page) {
        // Cache result
        this.cache.set(cacheKey, {
          page,
          timestamp: Date.now(),
        });

        // Cleanup old cache
        if (this.cache.size > this.maxCacheSize) {
          const oldest = Array.from(this.cache.entries()).sort(
            (a, b) => a[1].timestamp - b[1].timestamp
          )[0];
          this.cache.delete(oldest[0]);
        }
      }

      return page;
    } catch (error: any) {
      Logger.error("Wikipedia search failed", {
        query,
        error: error.message,
      });

      return null;
    }
  }

  /**
   * Fetch page
   */
  private async fetchPage(query: string): Promise<WikipediaPage | null> {
    // Mock Wikipedia page
    return {
      id: query.toLowerCase().replace(/\s+/g, "_"),
      title: query,
      url: `https://en.wikipedia.org/wiki/${encodeURIComponent(query)}`,
      summary: `${query} is a topic that has been documented on Wikipedia. This is a summary of the main article about ${query}.`,
      content: `
        ${query} is an important topic. This article provides comprehensive information about ${query}.
        
        The article covers various aspects including:
        - History and background
        - Key concepts and definitions
        - Current applications
        - Future developments
        - Related topics and references
      `,
      sections: [
        {
          title: "Introduction",
          content: `Introduction to ${query}...`,
        },
        {
          title: "History",
          content: `Historical background of ${query}...`,
        },
        {
          title: "Key Concepts",
          content: `Important concepts related to ${query}...`,
        },
      ],
      lastModified: Date.now(),
    };
  }

  /**
   * Get page summary
   */
  async getSummary(query: string): Promise<string | null> {
    const page = await this.search(query);
    return page ? page.summary : null;
  }

  /**
   * Get page sections
   */
  async getSections(query: string): Promise<Array<{ title: string; content: string }> | null> {
    const page = await this.search(query);
    return page ? page.sections : null;
  }

  /**
   * Get related pages
   */
  async getRelatedPages(query: string): Promise<string[]> {
    // Mock related pages
    return [
      `${query} history`,
      `${query} applications`,
      `${query} research`,
      `${query} technology`,
    ];
  }

  /**
   * Extract key information
   */
  async extractKeyInfo(query: string): Promise<Record<string, any> | null> {
    const page = await this.search(query);

    if (!page) {
      return null;
    }

    return {
      title: page.title,
      url: page.url,
      summary: page.summary,
      sectionCount: page.sections.length,
      lastModified: new Date(page.lastModified).toISOString(),
      imageCount: page.images?.length || 0,
      referenceCount: page.references?.length || 0,
    };
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    this.cache.clear();
    Logger.info("Wikipedia cache cleared");
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

export const createWikipediaTool = (): WikipediaTool => {
  return new WikipediaTool();
};
