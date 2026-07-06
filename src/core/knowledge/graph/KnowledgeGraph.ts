import {
  KnowledgeEntity,
  KnowledgeRelation,
  KnowledgeGraph as IKnowledgeGraph,
} from "../../../types/knowledge";
import { Logger } from "../../system/Logger";

/**
 * Knowledge Graph - Manages entities and relationships
 * Enables semantic reasoning and entity linking
 */

export class KnowledgeGraph {
  private entities: Map<string, KnowledgeEntity> = new Map();
  private relations: Map<string, KnowledgeRelation> = new Map();
  private entityIndex: Map<string, Set<string>> = new Map(); // type -> entity ids
  private relationIndex: Map<string, Set<string>> = new Map(); // type -> relation ids
  private entityIdCounter: number = 0;
  private relationIdCounter: number = 0;

  constructor() {
    Logger.info("KnowledgeGraph initialized");
  }

  /**
   * Add entity
   */
  addEntity(
    name: string,
    type: string,
    description: string = "",
    properties: Record<string, any> = {},
    importance: number = 50
  ): KnowledgeEntity {
    const entity: KnowledgeEntity = {
      id: this.generateEntityId(),
      name,
      type,
      description,
      properties,
      relatedEntities: [],
      importance,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    this.entities.set(entity.id, entity);

    // Index by type
    if (!this.entityIndex.has(type)) {
      this.entityIndex.set(type, new Set());
    }
    this.entityIndex.get(type)!.add(entity.id);

    Logger.debug("Entity added", {
      entityId: entity.id,
      name,
      type,
    });

    return entity;
  }

  /**
   * Add relation
   */
  addRelation(
    sourceId: string,
    targetId: string,
    type: string,
    weight: number = 1,
    properties: Record<string, any> = {}
  ): KnowledgeRelation | null {
    const source = this.entities.get(sourceId);
    const target = this.entities.get(targetId);

    if (!source || !target) {
      Logger.warn("Entity not found for relation", { sourceId, targetId });
      return null;
    }

    const relation: KnowledgeRelation = {
      id: this.generateRelationId(),
      sourceId,
      targetId,
      type,
      weight,
      properties,
      createdAt: Date.now(),
    };

    this.relations.set(relation.id, relation);

    // Index by type
    if (!this.relationIndex.has(type)) {
      this.relationIndex.set(type, new Set());
    }
    this.relationIndex.get(type)!.add(relation.id);

    // Update related entities
    if (!source.relatedEntities.includes(targetId)) {
      source.relatedEntities.push(targetId);
    }
    if (!target.relatedEntities.includes(sourceId)) {
      target.relatedEntities.push(sourceId);
    }

    Logger.debug("Relation added", {
      relationId: relation.id,
      sourceId,
      targetId,
      type,
    });

    return relation;
  }

  /**
   * Get entity
   */
  getEntity(entityId: string): KnowledgeEntity | undefined {
    return this.entities.get(entityId);
  }

  /**
   * Get entities by type
   */
  getEntitiesByType(type: string): KnowledgeEntity[] {
    const entityIds = this.entityIndex.get(type) || new Set();
    return Array.from(entityIds)
      .map((id) => this.entities.get(id))
      .filter((e) => e !== undefined) as KnowledgeEntity[];
  }

  /**
   * Get relations for entity
   */
  getRelationsForEntity(entityId: string): KnowledgeRelation[] {
    return Array.from(this.relations.values()).filter(
      (r) => r.sourceId === entityId || r.targetId === entityId
    );
  }

  /**
   * Get related entities
   */
  getRelatedEntities(entityId: string, depth: number = 1): KnowledgeEntity[] {
    const visited = new Set<string>();
    const related: KnowledgeEntity[] = [];

    const traverse = (id: string, currentDepth: number) => {
      if (visited.has(id) || currentDepth > depth) {
        return;
      }

      visited.add(id);

      const entity = this.entities.get(id);
      if (entity) {
        related.push(entity);

        for (const relatedId of entity.relatedEntities) {
          traverse(relatedId, currentDepth + 1);
        }
      }
    };

    traverse(entityId, 0);

    return related.filter((e) => e.id !== entityId);
  }

  /**
   * Find entity by name
   */
  findEntityByName(name: string): KnowledgeEntity | undefined {
    const normalized = name.toLowerCase();

    for (const entity of this.entities.values()) {
      if (entity.name.toLowerCase() === normalized) {
        return entity;
      }
    }

    return undefined;
  }

  /**
   * Search entities
   */
  searchEntities(query: string, limit: number = 10): KnowledgeEntity[] {
    const queryLower = query.toLowerCase();
    const results: Array<{
      entity: KnowledgeEntity;
      score: number;
    }> = [];

    for (const entity of this.entities.values()) {
      let score = 0;

      // Name match
      if (entity.name.toLowerCase().includes(queryLower)) {
        score += 10;
      }

      // Description match
      if (entity.description.toLowerCase().includes(queryLower)) {
        score += 5;
      }

      // Type match
      if (entity.type.toLowerCase().includes(queryLower)) {
        score += 3;
      }

      if (score > 0) {
        results.push({ entity, score });
      }
    }

    // Sort by score and importance
    results.sort((a, b) => {
      const scoreA = a.score + a.entity.importance / 100;
      const scoreB = b.score + b.entity.importance / 100;
      return scoreB - scoreA;
    });

    return results.slice(0, limit).map((r) => r.entity);
  }

  /**
   * Get shortest path between entities
   */
  getShortestPath(sourceId: string, targetId: string): string[] {
    const queue: Array<{ id: string; path: string[] }> = [
      { id: sourceId, path: [sourceId] },
    ];
    const visited = new Set<string>();

    while (queue.length > 0) {
      const { id, path } = queue.shift()!;

      if (id === targetId) {
        return path;
      }

      if (visited.has(id)) {
        continue;
      }

      visited.add(id);

      const entity = this.entities.get(id);
      if (entity) {
        for (const relatedId of entity.relatedEntities) {
          if (!visited.has(relatedId)) {
            queue.push({
              id: relatedId,
              path: [...path, relatedId],
            });
          }
        }
      }
    }

    return [];
  }

  /**
   * Get graph statistics
   */
  getStatistics(): Record<string, any> {
    const entities = Array.from(this.entities.values());
    const relations = Array.from(this.relations.values());

    const typeCount: Record<string, number> = {};
    const relationTypeCount: Record<string, number> = {};

    entities.forEach((e) => {
      typeCount[e.type] = (typeCount[e.type] || 0) + 1;
    });

    relations.forEach((r) => {
      relationTypeCount[r.type] = (relationTypeCount[r.type] || 0) + 1;
    });

    const avgImportance =
      entities.length > 0
        ? entities.reduce((sum, e) => sum + e.importance, 0) / entities.length
        : 0;

    const avgRelations =
      entities.length > 0
        ? entities.reduce((sum, e) => sum + e.relatedEntities.length, 0) /
          entities.length
        : 0;

    return {
      totalEntities: entities.length,
      totalRelations: relations.length,
      entityTypes: typeCount,
      relationTypes: relationTypeCount,
      averageImportance: avgImportance.toFixed(2),
      averageRelationsPerEntity: avgRelations.toFixed(2),
      density: entities.length > 0 ? (relations.length * 2) / (entities.length * (entities.length - 1)) : 0,
    };
  }

  /**
   * Export graph
   */
  export(): IKnowledgeGraph {
    return {
      entities: this.entities,
      relations: this.relations,
      entityIndex: this.entityIndex,
      relationIndex: this.relationIndex,
    };
  }

  /**
   * Clear graph
   */
  clear(): void {
    this.entities.clear();
    this.relations.clear();
    this.entityIndex.clear();
    this.relationIndex.clear();

    Logger.info("Knowledge graph cleared");
  }

  /**
   * Generate entity ID
   */
  private generateEntityId(): string {
    return `entity-${Date.now()}-${++this.entityIdCounter}`;
  }

  /**
   * Generate relation ID
   */
  private generateRelationId(): string {
    return `relation-${Date.now()}-${++this.relationIdCounter}`;
  }
}

export const createKnowledgeGraph = (): KnowledgeGraph => {
  return new KnowledgeGraph();
};
