import { WikipediaPage } from "../../types/webIntelligence";
import { Logger } from "../system/Logger";

/**
 * Wikipedia Tool — Real Production Implementation (Phase 12.9)
 * Uses the Wikipedia REST API v1 (free, no key required).
 * https://en.wikipedia.org/api/rest_v1/
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
   * Fetch Wikipedia page using the real REST API v1.
   * Phase 12.9: Replaced mock with real Wikipedia API calls.
   */
  private async fetchPage(query: string): Promise<WikipediaPage | null> {
    const encoded = encodeURIComponent(query.trim());

    // Step 1: Search for the best matching article title
    const searchRes = await fetch(
      `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encoded}&srlimit=1&format=json&origin=*`,
      { headers: { "User-Agent": "omni-one/1.0" }, signal: AbortSignal.timeout(10000) }
    );
    if (!searchRes.ok) throw new Error(`Wikipedia search HTTP ${searchRes.status}`);
    const searchData = await searchRes.json();
    const searchResults = searchData?.query?.search ?? [];
    if (searchResults.length === 0) return null;

    const pageTitle = searchResults[0].title as string;
    const encodedTitle = encodeURIComponent(pageTitle);

    // Step 2: Fetch the summary via REST API
    const summaryRes = await fetch(
      `https://en.wikipedia.org/api/rest_v1/page/summary/${encodedTitle}`,
      { headers: { "User-Agent": "omni-one/1.0", Accept: "application/json" }, signal: AbortSignal.timeout(10000) }
    );
    if (!summaryRes.ok) throw new Error(`Wikipedia summary HTTP ${summaryRes.status}`);
    const summaryData = await summaryRes.json();

    // Step 3: Fetch sections via parse API
    const sectionsRes = await fetch(
      `https://en.wikipedia.org/w/api.php?action=parse&page=${encodedTitle}&prop=sections&format=json&origin=*`,
      { headers: { "User-Agent": "omni-one/1.0" }, signal: AbortSignal.timeout(10000) }
    );
    const sectionsData = sectionsRes.ok ? await sectionsRes.json() : null;
    const rawSections = sectionsData?.parse?.sections ?? [];
    const sections = rawSections.slice(0, 10).map((s: any) => ({
      title: s.line ?? s.anchor ?? "",
      content: s.anchor ?? "",
    }));

    // Step 4: Fetch full plain text via extracts API
    const extractRes = await fetch(
      `https://en.wikipedia.org/w/api.php?action=query&titles=${encodedTitle}&prop=extracts&explaintext=1&exsectionformat=plain&format=json&origin=*`,
      { headers: { "User-Agent": "omni-one/1.0" }, signal: AbortSignal.timeout(15000) }
    );
    let fullContent = summaryData.extract ?? summaryData.description ?? "";
    if (extractRes.ok) {
      const extractData = await extractRes.json();
      const pages = extractData?.query?.pages ?? {};
      const pageContent = Object.values(pages)[0] as any;
      if (pageContent?.extract) fullContent = pageContent.extract.slice(0, 50000);
    }

    return {
      id: String(summaryData.pageid ?? pageTitle.toLowerCase().replace(/\s+/g, "_")),
      title: summaryData.title ?? pageTitle,
      url: summaryData.content_urls?.desktop?.page ?? `https://en.wikipedia.org/wiki/${encodedTitle}`,
      summary: summaryData.extract_html
        ? summaryData.extract_html.replace(/<[^>]+>/g, " ").replace(/\s{2,}/g, " ").trim()
        : summaryData.extract ?? "",
      content: fullContent,
      sections,
      images: summaryData.thumbnail ? [{ url: summaryData.thumbnail.source, caption: summaryData.title }] : [],
      references: [],
      lastModified: summaryData.timestamp ? new Date(summaryData.timestamp).getTime() : Date.now(),
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
   * Get related pages using Wikipedia's "related" REST API.
   */
  async getRelatedPages(query: string): Promise<string[]> {
    try {
      const encoded = encodeURIComponent(query.trim());
      const res = await fetch(
        `https://en.wikipedia.org/api/rest_v1/page/related/${encoded}`,
        { headers: { "User-Agent": "omni-one/1.0", Accept: "application/json" }, signal: AbortSignal.timeout(8000) }
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      return (data.pages ?? []).slice(0, 8).map((p: any) => p.title as string);
    } catch {
      return [];
    }
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
