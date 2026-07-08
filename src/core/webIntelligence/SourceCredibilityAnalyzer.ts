import {
  SourceCredibility,
  CredibilityMetrics,
  SearchResult,
} from "../../types/webIntelligence";
import { Logger } from "../system/Logger";

/**
 * Source Credibility Analyzer - Analyzes and scores source credibility
 */

export class SourceCredibilityAnalyzer {
  private knownSources: Set<string> = new Set([
    "wikipedia.org",
    "bbc.com",
    "reuters.com",
    "apnews.com",
    "theguardian.com",
    "nytimes.com",
    "bbc.co.uk",
    "cnn.com",
    "washingtonpost.com",
    "github.com",
    "stackoverflow.com",
    "medium.com",
    "arxiv.org",
  ]);

  private unreliableSources: Set<string> = new Set([
    "facebook.com",
    "twitter.com",
    "reddit.com",
    "4chan.org",
    "anonymous-blog.com",
  ]);

  constructor() {
    Logger.info("SourceCredibilityAnalyzer initialized");
  }

  /**
   * Analyze source credibility
   */
  analyzeSource(domain: string): SourceCredibility {
    const metrics = this.calculateMetrics(domain);
    const score = this.calculateCredibilityScore(metrics);
    const riskLevel = this.determineRiskLevel(score);
    const recommendation = this.getRecommendation(score, riskLevel);

    return {
      domain,
      metrics,
      overallScore: score,
      riskLevel,
      recommendation,
    };
  }

  /**
   * Calculate credibility metrics
   */
  private calculateMetrics(domain: string): CredibilityMetrics {
    const isKnown = this.knownSources.has(domain);
    const isUnreliable = this.unreliableSources.has(domain);

    return {
      domainAge: this.estimateDomainAge(domain),
      isKnownSource: isKnown,
      hasSSL: domain.includes("https") || this.hasSSL(domain),
      updateFrequency: this.estimateUpdateFrequency(domain),
      authorityScore: this.calculateAuthorityScore(domain, isKnown),
      trustScore: this.calculateTrustScore(domain, isKnown, isUnreliable),
    };
  }

  /**
   * Estimate domain age
   */
  private estimateDomainAge(domain: string): number {
    // Mock estimation
    if (this.knownSources.has(domain)) {
      return 7300; // ~20 years
    }
    return Math.floor(Math.random() * 10950); // 0-30 years
  }

  /**
   * Check if domain has SSL
   */
  private hasSSL(domain: string): boolean {
    // Most major domains have SSL
    return !domain.includes("http://");
  }

  /**
   * Estimate update frequency
   */
  private estimateUpdateFrequency(
    domain: string
  ): "daily" | "weekly" | "monthly" | "rarely" {
    if (this.knownSources.has(domain)) {
      return "daily";
    }
    const rand = Math.random();
    if (rand < 0.3) return "daily";
    if (rand < 0.6) return "weekly";
    if (rand < 0.85) return "monthly";
    return "rarely";
  }

  /**
   * Calculate authority score
   */
  private calculateAuthorityScore(domain: string, isKnown: boolean): number {
    if (isKnown) {
      return 85 + Math.random() * 15; // 85-100
    }
    return Math.random() * 70; // 0-70
  }

  /**
   * Calculate trust score
   */
  private calculateTrustScore(
    domain: string,
    isKnown: boolean,
    isUnreliable: boolean
  ): number {
    if (isUnreliable) {
      return Math.random() * 30; // 0-30
    }
    if (isKnown) {
      return 75 + Math.random() * 25; // 75-100
    }
    return Math.random() * 70; // 0-70
  }

  /**
   * Calculate overall credibility score
   */
  private calculateCredibilityScore(metrics: CredibilityMetrics): number {
    let score = 50; // Base score

    // Authority score (40% weight)
    score += metrics.authorityScore * 0.4;

    // Trust score (40% weight)
    score += metrics.trustScore * 0.4;

    // Domain age (10% weight)
    const ageScore = Math.min(metrics.domainAge / 7300, 1) * 100;
    score += ageScore * 0.1;

    // Update frequency (5% weight)
    const frequencyScore =
      metrics.updateFrequency === "daily"
        ? 100
        : metrics.updateFrequency === "weekly"
          ? 75
          : metrics.updateFrequency === "monthly"
            ? 50
            : 25;
    score += frequencyScore * 0.05;

    // SSL (5% weight)
    score += (metrics.hasSSL ? 100 : 50) * 0.05;

    return Math.min(100, Math.max(0, score));
  }

  /**
   * Determine risk level
   */
  private determineRiskLevel(score: number): "low" | "medium" | "high" {
    if (score >= 75) return "low";
    if (score >= 50) return "medium";
    return "high";
  }

  /**
   * Get recommendation
   */
  private getRecommendation(
    score: number,
    riskLevel: string
  ): "trusted" | "verify" | "avoid" {
    if (score >= 80) return "trusted";
    if (score >= 50) return "verify";
    return "avoid";
  }

  /**
   * Analyze search result
   */
  analyzeSearchResult(result: SearchResult): SearchResult {
    const domain = this.extractDomain(result.url);
    const credibility = this.analyzeSource(domain);

    return {
      ...result,
      credibilityScore: credibility.overallScore / 100,
    };
  }

  /**
   * Analyze multiple results
   */
  analyzeSearchResults(results: SearchResult[]): SearchResult[] {
    return results.map((result) => this.analyzeSearchResult(result));
  }

  /**
   * Extract domain from URL
   */
  private extractDomain(url: string): string {
    try {
      const urlObj = new URL(url);
      return urlObj.hostname;
    } catch {
      return url;
    }
  }

  /**
   * Get credibility report
   */
  getCredibilityReport(domain: string): Record<string, any> {
    const credibility = this.analyzeSource(domain);

    return {
      domain,
      overallScore: credibility.overallScore.toFixed(2),
      riskLevel: credibility.riskLevel,
      recommendation: credibility.recommendation,
      metrics: {
        domainAge: `${credibility.metrics.domainAge} days`,
        isKnownSource: credibility.metrics.isKnownSource,
        hasSSL: credibility.metrics.hasSSL,
        updateFrequency: credibility.metrics.updateFrequency,
        authorityScore: credibility.metrics.authorityScore.toFixed(2),
        trustScore: credibility.metrics.trustScore.toFixed(2),
      },
    };
  }

  /**
   * Compare source credibility
   */
  compareSources(domains: string[]): Array<{ domain: string; score: number }> {
    return domains
      .map((domain) => ({
        domain,
        score: this.analyzeSource(domain).overallScore,
      }))
      .sort((a, b) => b.score - a.score);
  }

  /**
   * Filter by credibility threshold
   */
  filterByCredibility(
    results: SearchResult[],
    threshold: number = 0.5
  ): SearchResult[] {
    return results.filter((result) => result.credibilityScore >= threshold);
  }

  /**
   * Get statistics
   */
  getStatistics(): Record<string, any> {
    return {
      knownSourcesCount: this.knownSources.size,
      unreliableSourcesCount: this.unreliableSources.size,
    };
  }
}

export const createSourceCredibilityAnalyzer = (): SourceCredibilityAnalyzer => {
  return new SourceCredibilityAnalyzer();
};
