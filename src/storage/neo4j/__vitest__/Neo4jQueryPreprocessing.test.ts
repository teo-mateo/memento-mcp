/**
 * Neo4j Query Preprocessing Integration Tests - Created by Claude Code on 2025-07-12
 * Purpose: Test query preprocessing feature toggle and functionality with real Neo4j and embeddings
 * Context: Validates that ENABLE_QUERY_PREPROCESSING environment variable controls the feature
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import { Neo4jStorageProvider } from '../Neo4jStorageProvider';
import { Neo4jConnectionManager } from '../Neo4jConnectionManager';
import { EmbeddingServiceFactory } from '../../../embeddings/EmbeddingServiceFactory';
import type { KnowledgeGraph } from '../../../KnowledgeGraphManager';

describe('Neo4j Query Preprocessing Integration', () => {
  let provider: Neo4jStorageProvider;
  let connectionManager: Neo4jConnectionManager;

  // Skip tests if not in integration test mode
  const shouldRunIntegrationTests = 
    process.env.TEST_INTEGRATION === 'true' &&
    process.env.NEO4J_URI &&
    process.env.NEO4J_PASSWORD;

  beforeAll(async () => {
    if (!shouldRunIntegrationTests) return;

    connectionManager = new Neo4jConnectionManager({
      uri: process.env.NEO4J_URI!,
      username: process.env.NEO4J_USERNAME || 'neo4j',
      password: process.env.NEO4J_PASSWORD!,
    });

    await connectionManager.connect();
  });

  afterAll(async () => {
    if (!shouldRunIntegrationTests) return;
    await connectionManager?.disconnect();
  });

  beforeEach(async () => {
    if (!shouldRunIntegrationTests) return;

    // Create provider with embedding service
    const embeddingService = EmbeddingServiceFactory.create();
    provider = new Neo4jStorageProvider({
      connectionManager,
      embeddingService,
    });

    await provider.initialize();

    // Clear the database
    const session = await connectionManager.getSession();
    try {
      await session.run('MATCH (n) DETACH DELETE n');
    } finally {
      await session.close();
    }

    // Create test data
    const testGraph: KnowledgeGraph = {
      entities: [
        {
          name: 'Fluffy the Programmer Rabbit',
          entityType: 'Character',
          observations: [
            'Expert in JavaScript and TypeScript',
            'Loves coding web applications',
            'Specializes in React and Angular development',
          ],
        },
        {
          name: 'Database Expert Owl',
          entityType: 'Character',
          observations: [
            'Masters SQL and NoSQL databases',
            'Expert in PostgreSQL and MongoDB',
            'Teaches database optimization',
          ],
        },
        {
          name: 'Machine Learning Fox',
          entityType: 'Character',
          observations: [
            'Specializes in artificial intelligence',
            'Expert in neural networks and deep learning',
            'Works with TensorFlow and PyTorch',
          ],
        },
      ],
      relations: [],
    };

    await provider.saveGraph(testGraph);

    // Generate embeddings for all entities
    const embeddingJobs = testGraph.entities.map(entity => 
      provider.updateEntityEmbedding(entity.name, embeddingService.generateEmbedding(
        `${entity.name} ${entity.observations.join(' ')}`
      ))
    );
    await Promise.all(embeddingJobs);
  });

  afterEach(async () => {
    if (!shouldRunIntegrationTests) return;

    // Reset environment variable to default
    delete process.env.ENABLE_QUERY_PREPROCESSING;
  });

  it.skipIf(!shouldRunIntegrationTests)(
    'should use default behavior when ENABLE_QUERY_PREPROCESSING is not set',
    async () => {
      // Ensure preprocessing is disabled
      delete process.env.ENABLE_QUERY_PREPROCESSING;

      // Multi-term query should fail with default threshold
      const results = await provider.semanticSearch('programmer developer coding', {
        minSimilarity: 0.6,
      });

      expect(results.entities).toHaveLength(0);

      // Check diagnostics confirm preprocessing was disabled
      if (results.diagnostics) {
        const preprocessingStep = results.diagnostics.stepsTaken.find(
          (step: any) => step.step === 'queryPreprocessing'
        );
        expect(preprocessingStep?.enabled).toBe(false);
      }
    }
  );

  it.skipIf(!shouldRunIntegrationTests)(
    'should use default behavior when ENABLE_QUERY_PREPROCESSING is false',
    async () => {
      process.env.ENABLE_QUERY_PREPROCESSING = 'false';

      // Multi-term query should fail with default threshold
      const results = await provider.semanticSearch('programmer developer coding', {
        minSimilarity: 0.6,
      });

      expect(results.entities).toHaveLength(0);

      // Check diagnostics confirm preprocessing was disabled
      if (results.diagnostics) {
        const preprocessingStep = results.diagnostics.stepsTaken.find(
          (step: any) => step.step === 'queryPreprocessing'
        );
        expect(preprocessingStep?.enabled).toBe(false);
      }
    }
  );

  it.skipIf(!shouldRunIntegrationTests)(
    'should enable preprocessing when ENABLE_QUERY_PREPROCESSING is true',
    async () => {
      process.env.ENABLE_QUERY_PREPROCESSING = 'true';
      process.env.DEBUG = 'true'; // Enable diagnostics

      // Multi-term query should succeed with adaptive threshold
      const results = await provider.semanticSearch('programmer developer coding', {
        minSimilarity: 0.6, // This will be overridden by adaptive threshold
      });

      // Should find at least Fluffy
      expect(results.entities.length).toBeGreaterThan(0);
      expect(results.entities.some(e => e.name.includes('Fluffy'))).toBe(true);

      // Check diagnostics
      expect(results.diagnostics).toBeDefined();
      const preprocessingStep = results.diagnostics.stepsTaken.find(
        (step: any) => step.step === 'queryPreprocessing'
      );
      expect(preprocessingStep?.enabled).toBe(true);
      expect(preprocessingStep?.adaptiveThreshold).toBeLessThan(0.6);
      expect(preprocessingStep?.queryComplexity).toBe(1); // 3 terms = max complexity

      // Check query analysis
      expect(results.diagnostics.queryAnalysis).toBeDefined();
      expect(results.diagnostics.queryAnalysis.termCount).toBe(3);
      expect(results.diagnostics.queryAnalysis.complexity).toBe(1);
      expect(results.diagnostics.queryAnalysis.recommendedThreshold).toBeLessThan(0.6);
    }
  );

  it.skipIf(!shouldRunIntegrationTests)(
    'should respect enableAdaptiveThresholds option',
    async () => {
      process.env.ENABLE_QUERY_PREPROCESSING = 'true';

      // Test with adaptive thresholds disabled
      const results = await provider.semanticSearch('programmer developer coding', {
        minSimilarity: 0.8,
        enableAdaptiveThresholds: false,
      });

      // Should not find results with high threshold
      expect(results.entities).toHaveLength(0);
    }
  );

  it.skipIf(!shouldRunIntegrationTests)(
    'should work with database-related queries',
    async () => {
      process.env.ENABLE_QUERY_PREPROCESSING = 'true';

      const results = await provider.semanticSearch('database SQL NoSQL MongoDB PostgreSQL', {
        minSimilarity: 0.6,
      });

      // Should find Database Expert Owl
      expect(results.entities.length).toBeGreaterThan(0);
      expect(results.entities.some(e => e.name.includes('Database Expert Owl'))).toBe(true);
    }
  );

  it.skipIf(!shouldRunIntegrationTests)(
    'should work with machine learning queries',
    async () => {
      process.env.ENABLE_QUERY_PREPROCESSING = 'true';

      const results = await provider.semanticSearch('machine learning AI artificial intelligence', {
        minSimilarity: 0.6,
      });

      // Should find Machine Learning Fox
      expect(results.entities.length).toBeGreaterThan(0);
      expect(results.entities.some(e => e.name.includes('Machine Learning Fox'))).toBe(true);
    }
  );

  it.skipIf(!shouldRunIntegrationTests)(
    'should normalize queries with extra whitespace',
    async () => {
      process.env.ENABLE_QUERY_PREPROCESSING = 'true';
      process.env.DEBUG = 'true';

      const results = await provider.semanticSearch('  javascript   web   development  ', {
        minSimilarity: 0.6,
      });

      // Should normalize the query
      expect(results.diagnostics?.queryAnalysis?.normalizedQuery).toBe('javascript web development');
      
      // Should find Fluffy
      expect(results.entities.length).toBeGreaterThan(0);
      expect(results.entities.some(e => e.name.includes('Fluffy'))).toBe(true);
    }
  );

  it.skipIf(!shouldRunIntegrationTests)(
    'should handle single-term queries appropriately',
    async () => {
      process.env.ENABLE_QUERY_PREPROCESSING = 'true';
      process.env.DEBUG = 'true';

      const results = await provider.semanticSearch('database', {
        minSimilarity: 0.6,
      });

      // Check that single term gets max threshold
      expect(results.diagnostics?.queryAnalysis?.complexity).toBe(0);
      expect(results.diagnostics?.queryAnalysis?.recommendedThreshold).toBe(0.6);

      // Should find Database Expert Owl
      expect(results.entities.length).toBeGreaterThan(0);
      expect(results.entities.some(e => e.name.includes('Database Expert Owl'))).toBe(true);
    }
  );

  it.skipIf(!shouldRunIntegrationTests)(
    'should work with custom preprocessing options',
    async () => {
      process.env.ENABLE_QUERY_PREPROCESSING = 'true';
      process.env.DEBUG = 'true';

      const results = await provider.semanticSearch('AI ML deep learning', {
        minSimilarity: 0.6,
        queryPreprocessing: {
          minThresholdMultiTerm: 0.3,
          maxThresholdSingleTerm: 0.7,
          complexityThreshold: 4,
        },
      });

      // With custom thresholds, should find results
      expect(results.entities.length).toBeGreaterThan(0);
      expect(results.diagnostics?.queryAnalysis?.recommendedThreshold).toBeLessThanOrEqual(0.7);
      expect(results.diagnostics?.queryAnalysis?.recommendedThreshold).toBeGreaterThanOrEqual(0.3);
    }
  );
});