import { ProviderName } from "../../types";
import { Logger } from "./Logger";

export type HealthStatus = "healthy" | "degraded" | "offline";

export class ProviderHealth {
  private static healthMap = new Map<ProviderName, { status: HealthStatus; failures: number; lastChecked: number }>();
  private static readonly FAILURE_THRESHOLD = 3;
  private static readonly RECOVERY_TIME = 300000; // 5 minutes

  static recordSuccess(provider: ProviderName): void {
    const health = this.getHealth(provider);
    health.failures = 0;
    health.status = "healthy";
    health.lastChecked = Date.now();
    this.healthMap.set(provider, health);
  }

  static recordFailure(provider: ProviderName): void {
    const health = this.getHealth(provider);
    health.failures++;
    health.lastChecked = Date.now();

    if (health.failures >= this.FAILURE_THRESHOLD) {
      health.status = "offline";
      Logger.warn(`Provider ${provider} is now OFFLINE due to repeated failures.`);
    } else if (health.failures > 0) {
      health.status = "degraded";
      Logger.warn(`Provider ${provider} is DEGRADED.`, { failures: health.failures });
    }
    
    this.healthMap.set(provider, health);
  }

  static isAvailable(provider: ProviderName): boolean {
    const health = this.getHealth(provider);
    
    // Auto-recovery check
    if (health.status === "offline" && Date.now() - health.lastChecked > this.RECOVERY_TIME) {
      health.status = "degraded"; // Try again
      health.failures = this.FAILURE_THRESHOLD - 1;
      Logger.info(`Provider ${provider} attempting recovery.`);
      return true;
    }

    return health.status !== "offline";
  }

  private static getHealth(provider: ProviderName) {
    return this.healthMap.get(provider) || { status: "healthy" as HealthStatus, failures: 0, lastChecked: Date.now() };
  }

  static getStatus(provider: ProviderName): HealthStatus {
    return this.getHealth(provider).status;
  }
}
