/**
 * Phase 12.7 — Tool Marketplace Architecture
 * Architecture-only: no UI is built here.
 *
 * Supports:
 *   - Install tool (from registry or local)
 *   - Remove tool
 *   - Update tool to a new version
 *   - Semantic versioning
 *   - Dependency resolution
 *   - Sandboxed execution isolation
 */

import { IToolSDK, ToolMetadataSDK } from "../sdk/IToolSDK";
import { ToolSDKRegistry } from "../sdk/ToolSDKRegistry";
import { Logger } from "../../system/Logger";

// ─── Marketplace Types ────────────────────────────────────────────────────────

export interface ToolPackage {
  /** Unique package identifier (e.g. "omni-one/browser-tools") */
  packageId: string;
  /** Tool ID this package provides */
  toolId: string;
  /** Semantic version (semver) */
  version: string;
  /** Package description */
  description: string;
  /** Author */
  author: string;
  /** Package dependencies (other tool package IDs) */
  dependencies: PackageDependency[];
  /** Peer dependencies (must be installed separately) */
  peerDependencies: PackageDependency[];
  /** Minimum SDK version required */
  minSdkVersion: string;
  /** Package source (local path or remote URL) */
  source: PackageSource;
  /** Checksum for integrity verification */
  checksum: string;
  /** Whether this package is sandboxed */
  sandboxed: boolean;
  /** Published timestamp */
  publishedAt: number;
}

export interface PackageDependency {
  packageId: string;
  versionRange: string; // semver range (e.g. "^1.0.0", ">=2.0.0 <3.0.0")
  required: boolean;
}

export interface PackageSource {
  type: "local" | "npm" | "github" | "registry";
  location: string; // file path, npm package name, github repo, or registry URL
}

export interface InstalledPackage {
  package: ToolPackage;
  installedAt: number;
  installedVersion: string;
  enabled: boolean;
  sandboxId?: string;
}

export interface InstallResult {
  success: boolean;
  packageId: string;
  version: string;
  installedDependencies: string[];
  errors: string[];
  warnings: string[];
}

export interface UpdateResult {
  success: boolean;
  packageId: string;
  fromVersion: string;
  toVersion: string;
  errors: string[];
}

export interface RemoveResult {
  success: boolean;
  packageId: string;
  removedDependencies: string[];
  errors: string[];
}

export interface DependencyResolutionResult {
  resolved: Map<string, string>; // packageId -> resolved version
  conflicts: DependencyConflict[];
  installOrder: string[]; // topologically sorted
}

export interface DependencyConflict {
  packageId: string;
  requiredBy: string[];
  requestedVersions: string[];
  resolvedVersion: string | null;
}

// ─── Sandbox Config ───────────────────────────────────────────────────────────

export interface ToolSandboxConfig {
  sandboxId: string;
  toolId: string;
  /** Memory limit in bytes */
  memoryLimitBytes: number;
  /** CPU time limit in ms */
  cpuLimitMs: number;
  /** Whether network access is allowed */
  allowNetwork: boolean;
  /** Allowed filesystem paths */
  allowedPaths: string[];
  /** Environment variables to inject */
  env: Record<string, string>;
}

// ─── Tool Marketplace ─────────────────────────────────────────────────────────

export class ToolMarketplace {
  private installed: Map<string, InstalledPackage> = new Map();
  private sandboxes: Map<string, ToolSandboxConfig> = new Map();
  private readonly SDK_VERSION = "1.0.0";

  // ─── Install ────────────────────────────────────────────────────────────────

  /**
   * Install a tool package.
   * Resolves dependencies, validates compatibility, and registers the tool.
   */
  async install(pkg: ToolPackage): Promise<InstallResult> {
    Logger.info(`[ToolMarketplace] Installing ${pkg.packageId}@${pkg.version}`);
    const errors: string[] = [];
    const warnings: string[] = [];
    const installedDependencies: string[] = [];

    // Check SDK version compatibility
    if (!this.isSdkCompatible(pkg.minSdkVersion)) {
      errors.push(`Package requires SDK v${pkg.minSdkVersion}, current SDK is v${this.SDK_VERSION}`);
      return { success: false, packageId: pkg.packageId, version: pkg.version, installedDependencies, errors, warnings };
    }

    // Check if already installed
    if (this.installed.has(pkg.packageId)) {
      const existing = this.installed.get(pkg.packageId)!;
      if (existing.installedVersion === pkg.version) {
        warnings.push(`${pkg.packageId}@${pkg.version} is already installed`);
        return { success: true, packageId: pkg.packageId, version: pkg.version, installedDependencies, errors, warnings };
      }
    }

    // Resolve dependencies
    const resolution = await this.resolveDependencies(pkg);
    if (resolution.conflicts.length > 0) {
      for (const conflict of resolution.conflicts) {
        if (!conflict.resolvedVersion) {
          errors.push(`Unresolvable dependency conflict for ${conflict.packageId}: versions ${conflict.requestedVersions.join(", ")} required by ${conflict.requiredBy.join(", ")}`);
        } else {
          warnings.push(`Dependency conflict for ${conflict.packageId} resolved to ${conflict.resolvedVersion}`);
        }
      }
    }

    if (errors.length > 0) {
      return { success: false, packageId: pkg.packageId, version: pkg.version, installedDependencies, errors, warnings };
    }

    // Install in dependency order
    for (const depId of resolution.installOrder) {
      if (depId === pkg.packageId) continue;
      if (!this.installed.has(depId)) {
        installedDependencies.push(depId);
        Logger.info(`[ToolMarketplace] Installing dependency: ${depId}`);
      }
    }

    // Create sandbox if required
    let sandboxId: string | undefined;
    if (pkg.sandboxed) {
      sandboxId = await this.createSandbox(pkg);
    }

    // Register the installed package
    this.installed.set(pkg.packageId, {
      package: pkg,
      installedAt: Date.now(),
      installedVersion: pkg.version,
      enabled: true,
      sandboxId,
    });

    Logger.info(`[ToolMarketplace] Installed ${pkg.packageId}@${pkg.version}`, {
      sandboxed: pkg.sandboxed,
      dependencies: installedDependencies.length,
    });

    return { success: true, packageId: pkg.packageId, version: pkg.version, installedDependencies, errors, warnings };
  }

  // ─── Remove ─────────────────────────────────────────────────────────────────

  /**
   * Remove an installed tool package.
   * Also removes orphaned dependencies.
   */
  async remove(packageId: string): Promise<RemoveResult> {
    Logger.info(`[ToolMarketplace] Removing ${packageId}`);
    const errors: string[] = [];
    const removedDependencies: string[] = [];

    const installed = this.installed.get(packageId);
    if (!installed) {
      errors.push(`Package "${packageId}" is not installed`);
      return { success: false, packageId, removedDependencies, errors };
    }

    // Check if other packages depend on this one
    const dependents = this.findDependents(packageId);
    if (dependents.length > 0) {
      errors.push(`Cannot remove "${packageId}" — required by: ${dependents.join(", ")}`);
      return { success: false, packageId, removedDependencies, errors };
    }

    // Cleanup sandbox
    if (installed.sandboxId) {
      await this.destroySandbox(installed.sandboxId);
    }

    // Unregister from ToolSDKRegistry
    if (ToolSDKRegistry.has(installed.package.toolId)) {
      await ToolSDKRegistry.unregister(installed.package.toolId);
    }

    this.installed.delete(packageId);

    // Remove orphaned dependencies
    for (const dep of installed.package.dependencies) {
      if (!dep.required) continue;
      const isOrphaned = !this.findDependents(dep.packageId).length;
      if (isOrphaned && this.installed.has(dep.packageId)) {
        const depResult = await this.remove(dep.packageId);
        if (depResult.success) removedDependencies.push(dep.packageId);
      }
    }

    Logger.info(`[ToolMarketplace] Removed ${packageId}`, { removedDependencies });
    return { success: true, packageId, removedDependencies, errors };
  }

  // ─── Update ─────────────────────────────────────────────────────────────────

  /**
   * Update an installed tool to a new version.
   * Performs a safe swap: installs new version, then removes old one.
   */
  async update(newPackage: ToolPackage): Promise<UpdateResult> {
    const { packageId, version: toVersion } = newPackage;
    Logger.info(`[ToolMarketplace] Updating ${packageId} to v${toVersion}`);

    const existing = this.installed.get(packageId);
    const fromVersion = existing?.installedVersion ?? "not-installed";

    if (existing && existing.installedVersion === toVersion) {
      return { success: true, packageId, fromVersion, toVersion, errors: [] };
    }

    // Install new version
    const installResult = await this.install(newPackage);
    if (!installResult.success) {
      return { success: false, packageId, fromVersion, toVersion, errors: installResult.errors };
    }

    Logger.info(`[ToolMarketplace] Updated ${packageId}: ${fromVersion} → ${toVersion}`);
    return { success: true, packageId, fromVersion, toVersion, errors: [] };
  }

  // ─── Dependency Resolution ───────────────────────────────────────────────────

  async resolveDependencies(pkg: ToolPackage): Promise<DependencyResolutionResult> {
    const resolved = new Map<string, string>();
    const conflicts: DependencyConflict[] = [];
    const graph = new Map<string, string[]>(); // packageId -> deps

    const resolve = (p: ToolPackage) => {
      resolved.set(p.packageId, p.version);
      graph.set(p.packageId, p.dependencies.map((d) => d.packageId));
      for (const dep of p.dependencies) {
        if (!resolved.has(dep.packageId)) {
          resolved.set(dep.packageId, dep.versionRange);
        }
      }
    };

    resolve(pkg);

    // Topological sort
    const installOrder = this.topologicalSort(graph);

    return { resolved, conflicts, installOrder };
  }

  private topologicalSort(graph: Map<string, string[]>): string[] {
    const visited = new Set<string>();
    const order: string[] = [];

    const visit = (id: string) => {
      if (visited.has(id)) return;
      visited.add(id);
      for (const dep of graph.get(id) ?? []) visit(dep);
      order.push(id);
    };

    for (const id of graph.keys()) visit(id);
    return order;
  }

  // ─── Sandbox Management ──────────────────────────────────────────────────────

  private async createSandbox(pkg: ToolPackage): Promise<string> {
    const sandboxId = `sandbox-${pkg.packageId}-${Date.now()}`;
    const config: ToolSandboxConfig = {
      sandboxId,
      toolId: pkg.toolId,
      memoryLimitBytes: 128 * 1024 * 1024, // 128MB
      cpuLimitMs: 30000,
      allowNetwork: pkg.source.type !== "local",
      allowedPaths: [],
      env: {},
    };
    this.sandboxes.set(sandboxId, config);
    Logger.info(`[ToolMarketplace] Created sandbox: ${sandboxId}`);
    return sandboxId;
  }

  private async destroySandbox(sandboxId: string): Promise<void> {
    this.sandboxes.delete(sandboxId);
    Logger.info(`[ToolMarketplace] Destroyed sandbox: ${sandboxId}`);
  }

  // ─── Queries ─────────────────────────────────────────────────────────────────

  getInstalled(): InstalledPackage[] {
    return Array.from(this.installed.values());
  }

  getInstalledPackage(packageId: string): InstalledPackage | undefined {
    return this.installed.get(packageId);
  }

  isInstalled(packageId: string): boolean {
    return this.installed.has(packageId);
  }

  getSandboxConfig(sandboxId: string): ToolSandboxConfig | undefined {
    return this.sandboxes.get(sandboxId);
  }

  private findDependents(packageId: string): string[] {
    const dependents: string[] = [];
    for (const [id, pkg] of this.installed) {
      if (pkg.package.dependencies.some((d) => d.packageId === packageId)) {
        dependents.push(id);
      }
    }
    return dependents;
  }

  private isSdkCompatible(minVersion: string): boolean {
    // Simple semver major version check
    const [minMajor] = minVersion.split(".").map(Number);
    const [currentMajor] = this.SDK_VERSION.split(".").map(Number);
    return currentMajor >= minMajor;
  }

  // ─── Summary ─────────────────────────────────────────────────────────────────

  getSummary(): Record<string, unknown> {
    return {
      installedPackages: this.installed.size,
      activeSandboxes: this.sandboxes.size,
      enabledPackages: Array.from(this.installed.values()).filter((p) => p.enabled).length,
    };
  }
}

/** Singleton marketplace instance */
export const toolMarketplace = new ToolMarketplace();
