import { ScrapedContent, ScrapingTask } from "../../types/webIntelligence";
import { Logger } from "../system/Logger";

/**
 * URL Reader Tool - Reads and extracts content from URLs
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
   * Scrape URL
   */
  private async scrapeURL(url: string): Promise<ScrapedContent | null> {
    // Mock scraping
    try {
      const urlObj = new URL(url);
      const domain = urlObj.hostname;

      return {
        url,
        title: `Content from ${domain}`,
        content: `This is the extracted content from ${url}. 
        
        The page contains relevant information about the topic.
        Multiple paragraphs of content would be extracted here.
        
        Key information and main points are highlighted.`,
        metadata: {
          author: "Unknown",
          publishDate: new Date().toISOString(),
          description: `Content from ${domain}`,
          keywords: ["content", "information", "article"],
          language: "en",
        },
        images: [
          {
            src: "https://example.com/image1.jpg",
            alt: "Sample image",
          },
        ],
        links: [
          {
            href: "https://example.com/related",
            text: "Related article",
          },
        ],
        scrapedAt: Date.now(),
      };
    } catch (error) {
      return null;
    }
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
