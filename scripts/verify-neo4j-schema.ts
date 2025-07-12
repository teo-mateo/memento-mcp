#!/usr/bin/env tsx

/**
 * Neo4j Schema Verification Script
 * 
 * Created by Claude Code on 2025-07-12
 * Purpose: Verify the current state of the Neo4j database schema
 * Context: This script helps verify that the schema is properly configured with the correct
 * indexes, constraints, and vector dimensions after a reset or initialization.
 */

import * as dotenv from 'dotenv';
import { Neo4jConnectionManager } from '../src/storage/neo4j/Neo4jConnectionManager.js';
import { Neo4jSchemaManager } from '../src/storage/neo4j/Neo4jSchemaManager.js';
import { DEFAULT_NEO4J_CONFIG } from '../src/storage/neo4j/Neo4jConfig.js';
import { logger } from '../src/utils/logger.js';

// Load environment variables from .env file if it exists
dotenv.config();

async function verifyNeo4jSchema(): Promise<void> {
  logger.info('🔍 Verifying Neo4j database schema...');
  
  // Create connection manager with environment variables or defaults
  const config = {
    ...DEFAULT_NEO4J_CONFIG,
    uri: process.env.NEO4J_URI || DEFAULT_NEO4J_CONFIG.uri,
    username: process.env.NEO4J_USERNAME || DEFAULT_NEO4J_CONFIG.username,
    password: process.env.NEO4J_PASSWORD || DEFAULT_NEO4J_CONFIG.password,
    database: process.env.NEO4J_DATABASE || DEFAULT_NEO4J_CONFIG.database,
  };

  const connectionManager = new Neo4jConnectionManager(config);
  const schemaManager = new Neo4jSchemaManager(connectionManager, config, true);

  try {
    // Test connection
    logger.info('📡 Testing Neo4j connection...');
    await connectionManager.executeQuery('RETURN 1', {});
    logger.info('✅ Neo4j connection successful');

    // Check current data counts
    logger.info('📊 Checking current database state...');
    const nodeCountResult = await connectionManager.executeQuery('MATCH (n) RETURN count(n) as nodeCount', {});
    const relationshipCountResult = await connectionManager.executeQuery('MATCH ()-[r]->() RETURN count(r) as relCount', {});
    const nodeCount = nodeCountResult.records[0]?.get('nodeCount')?.toNumber() || 0;
    const relCount = relationshipCountResult.records[0]?.get('relCount')?.toNumber() || 0;
    
    logger.info(`📈 Current data: ${nodeCount} nodes, ${relCount} relationships`);

    // List all constraints
    logger.info('🔍 Checking constraints...');
    const constraints = await schemaManager.listConstraints();
    logger.info(`📋 Found ${constraints.length} constraints:`);
    constraints.forEach((constraint, index) => {
      logger.info(`  ${index + 1}. ${constraint.name} (${constraint.type})`);
    });

    // List all indexes  
    logger.info('🔍 Checking indexes...');
    const indexes = await schemaManager.listIndexes();
    logger.info(`📋 Found ${indexes.length} indexes:`);
    indexes.forEach((index, i) => {
      const state = index.state || 'UNKNOWN';
      const type = index.type || 'UNKNOWN';
      logger.info(`  ${i + 1}. ${index.name} (${type}, ${state})`);
    });

    // Check vector index specifically
    logger.info('🔍 Checking vector index...');
    const vectorIndexExists = await schemaManager.vectorIndexExists(config.vectorIndexName);
    logger.info(`📊 Vector index '${config.vectorIndexName}' status: ${vectorIndexExists ? 'ONLINE' : 'NOT FOUND/OFFLINE'}`);

    if (vectorIndexExists) {
      // Try to get vector index details
      try {
        const vectorIndexResult = await connectionManager.executeQuery(
          'SHOW VECTOR INDEXES WHERE name = $indexName',
          { indexName: config.vectorIndexName }
        );
        
        if (vectorIndexResult.records.length > 0) {
          const record = vectorIndexResult.records[0];
          const dimensions = record.get('options')?.vectorDimensions;
          const similarityFunction = record.get('options')?.vectorSimilarityFunction;
          
          logger.info(`📊 Vector index details:`);
          logger.info(`   Dimensions: ${dimensions || 'Unknown'}`);
          logger.info(`   Similarity Function: ${similarityFunction || 'Unknown'}`);
        }
      } catch (error) {
        logger.info('📊 Could not retrieve vector index details (may be Neo4j version < 5.13)');
      }
    }

    // Summary
    logger.info('📋 Configuration Summary:');
    logger.info(`   Database: ${config.database}`);
    logger.info(`   Vector Index: ${config.vectorIndexName}`);
    logger.info(`   Expected Vector Dimensions: ${config.vectorDimensions}`);
    logger.info(`   Expected Similarity Function: ${config.similarityFunction}`);

    logger.info('✅ Schema verification completed!');
    
  } catch (error) {
    logger.error('❌ Error during schema verification:', error);
    throw error;
  } finally {
    // Close connections
    await schemaManager.close();
  }
}

// Run the script if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  verifyNeo4jSchema()
    .then(() => {
      logger.info('🎉 Verification script completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      logger.error('💥 Verification script failed:', error);
      process.exit(1);
    });
}

export { verifyNeo4jSchema };