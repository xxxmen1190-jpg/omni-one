import { ScrapedContent, ScrapingTask } from "../../types/webIntelligence";
import { Logger } from "../system/Logger";

/**
 * URL Reader Tool — Real Production Implementation (Phase 12.9)
 * Uses real HTTP fetch with lightweight HTML parsing.
 * No external dependencies required.
 */

export class URLReaderTool {
  private cache: Map<string, { content: ScrapedContent; timestamp: number }> = new Map();
  private cacheTTL: number = 3600000; // 1 hour
  private maxCacheSize: number = 100;
  private activeTasks: Map<string, ScrapingTask> = new Map();
  private taskIdCounter: number = 0;

  constructor() {
    Logger.info("URLReaderTool initialized");
  }

  /**
   * Read URL
   */
  async readURL(url: string): Promise<ScrapedContent | null> {
    const cacheKey = `url:${url}`;

    // Check cache
    const cached = this.cache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < this.cacheTTL) {
      Logger.debug("URL cache hit", { url });
      return cached.content;
    }

    try {
      Logger.info("Reading URL", { url });

      const content = await this.scrapeURL(url);

      if (content) {
        // Cache result
        this.cache.set(cacheKey, {
          content,
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

      return content;
    } catch (error: any) {
      Logger.error("URL reading failed", {
        url,
        error: error.message,
      });

      return null;
    }
  }

  /**
   * Scrape URL — Real implementation using fetch + regex-based HTML parsing.
   * Phase 12.9: Replaced mock with real HTTP fetch and structured extraction.
   */
  private async scrapeURL(url: string): Promise<ScrapedContent | null> {
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; OmniOneBot/1.0)",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
      },
      signal: AbortSignal.timeout(15000),
      redirect: "follow",
    });

    if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
    const html = await res.text();
    const baseUrl = new URL(url);

    // Title
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    const title = titleMatch ? this.decodeHtml(titleMatch[1].trim()) : baseUrl.hostname;

    // Meta description
    const descMatch = html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i)
      ?? html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+name=["']description["']/i);
    const description = descMatch ? this.decodeHtml(descMatch[1]) : undefined;

    // Author
    const authorMatch = html.match(/<meta[^>]+name=["']author["'][^>]+content=["']([^"']+)["']/i)
      ?? html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+name=["']author["']/i);
    const author = authorMatch ? this.decodeHtml(authorMatch[1]) : undefined;

    // Publish date
    const dateMatch = html.match(/<meta[^>]+(?:name|property)=["'](?:article:published_time|datePublished)["'][^>]+content=["']([^"']+)["']/i);
    const publishDate = dateMatch ? dateMatch[1] : undefined;

    // Keywords
    const kwMatch = html.match(/<meta[^>]+name=["']keywords["'][^>]+content=["']([^"']+)["']/i);
    const keywords = kwMatch ? kwMatch[1].split(",").map((k) => k.trim()).filter(Boolean) : [];

    // Body text — strip scripts/styles/nav/footer then remove all tags
    let bodyHtml = html
      .replace(/<script[\s\S]*?<\/script>/gi, "")
      .replace(/<style[\s\S]*?<\/style>/gi, "")
      .replace(/<nav[\s\S]*?<\/nav>/gi, "")
      .replace(/<footer[\s\S]*?<\/footer>/gi, "")
      .replace(/<header[\s\S]*?<\/header>/gi, "");
    const mainMatch = bodyHtml.match(/<(?:main|article)[^>]*>([\s\S]*?)<\/(?:main|article)>/i);
    if (mainMatch) bodyHtml = mainMatch[1];
    const content = this.decodeHtml(
      bodyHtml.replace(/<[^>]+>/g, " ").replace(/\s{2,}/g, " ").trim()
    ).slice(0, 50000);

    // Links
    const linkRe = /<a[^>]+href=["']([^"'#][^"']*)["'][^>]*>([^<]*)<\/a>/gi;
    const links: Array<{ href: string; text: string }> = [];
    let lm: RegExpExecArray | null;
    while ((lm = linkRe.exec(html)) !== null && links.length < 30) {
      try {
        const href = new URL(lm[1], baseUrl).href;
        const text = this.decodeHtml(lm[2].trim());
        if (text && href.startsWith("http")) links.push({ href, text });
      } catch { /* skip */ }
    }

    // Images
    const imgRe = /<img[^>]+src=["']([^"']+)["'][^>]*>/gi;
    const images: Array<{ src: string; alt?: string }> = [];
    let im: RegExpExecArray | null;
    while ((im = imgRe.exec(html)) !== null && images.length < 20) {
      try {
        const src = new URL(im[1], baseUrl).href;
        const altMatch = im[0].match(/alt=["']([^"']*)["']/);
        if (src.startsWith("http")) images.push({ src, alt: altMatch?.[1] });
      } catch { /* skip */ }
    }

    return { url, title, content, html, metadata: { author, publishDate, description, keywords, language: "en" }, images, links, scrapedAt: Date.now() };
  }

  private decodeHtml(str: string): string {
    return str
      .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, " ")
      .replace(/&#(\d+);/g, (_, c) => String.fromCharCode(Number(c)));
  }

  /**
   * Read multiple URLs
   */
  async readMultipleURLs(urls: string[]): Promise<ScrapedContent[]> {
    const results: ScrapedContent[] = [];

    for (const url of urls) {
      const content = await this.readURL(url);
      if (content) {
        results.push(content);
      }
    }

    return results;
  }

  /**
   * Extract text from URL
   */
  async extractText(url: string): Promise<string | null> {
    const content = await this.readURL(url);
    return content ? content.content : null;
  }

  /**
   * Extract metadata from URL
   */
  async extractMetadata(url: string): Promise<Record<string, any> | null> {
    const content = await this.readURL(url);
    return content ? content.metadata : null;
  }

  /**
   * Extract links from URL
   */
  async extractLinks(url: string): Promise<Array<{ href: string; text: string }> | null> {
    const content = await this.readURL(url);
    return content ? content.links || [] : null;
  }

  /**
   * Create scraping task
   */
  createScrapingTask(url: string): ScrapingTask {
    const taskId = `task-${Date.now()}-${++this.taskIdCounter}`;

    const task: ScrapingTask = {
      id: taskId,
      url,
      status: "pending",
      startTime: Date.now(),
    };

    this.activeTasks.set(taskId, task);

    return task;
  }

  /**
   * Get scraping task
   */
  getScrapingTask(taskId: string): ScrapingTask | undefined {
    return this.activeTasks.get(taskId);
  }

  /**
   * Execute scraping task
   */
  async executeScrapingTask(taskId: string): Promise<ScrapedContent | null> {
    const task = this.activeTasks.get(taskId);

    if (!task) {
      return null;
    }

    task.status = "scraping";

    try {
      const content = await this.readURL(task.url);

      task.status = "completed";
      task.content = content || undefined;
      task.endTime = Date.now();
      task.duration = task.endTime - (task.startTime || 0);

      return content;
    } catch (error: any) {
      task.status = "failed";
      task.error = error.message;
      task.endTime = Date.now();
      task.duration = task.endTime - (task.startTime || 0);

      return null;
    }
  }

  /**
   * Get content summary
   */
  async getContentSummary(url: string): Promise<string | null> {
    const content = await this.readURL(url);

    if (!content) {
      return null;
    }

    // Return first 300 characters as summary
    return content.content.substring(0, 300) + "...";
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    this.cache.clear();
    Logger.info("URL cache cleared");
  }

  /**
   * Get cache statistics
   */
  getCacheStatistics(): Record<string, any> {
    return {
      cacheSize: this.cache.size,
      maxCacheSize: this.maxCacheSize,
      cacheTTL: this.cacheTTL,
      activeTasks: this.activeTasks.size,
    };
  }
}

export const createURLReaderTool = (): URLReaderTool => {
  return new URLReaderTool();
};
