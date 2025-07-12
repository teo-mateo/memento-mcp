#!/usr/bin/env tsx

/**
 * Neo4j Database Reset Script
 * 
 * Created by Claude Code on 2025-07-12
 * Purpose: Completely reset the Neo4j database to eliminate dimension mismatches and other issues
 * Context: This script was created to provide a clean slate reset for the memento-mcp Neo4j database,
 * removing all data, indexes, and constraints, then recreating them with proper 1536 dimensions.
 * 
 * This script:
 * 1. Connects to Neo4j using the existing connection manager
 * 2. Deletes all nodes and relationships
 * 3. Drops all indexes (including vector indexes)
 * 4. Drops all constraints
 * 5. Reinitializes the schema with proper 1536 dimensions
 */

import * as dotenv from 'dotenv';
import { Neo4jConnectionManager } from '../src/storage/neo4j/Neo4jConnectionManager.js';
import { Neo4jSchemaManager } from '../src/storage/neo4j/Neo4jSchemaManager.js';
import { DEFAULT_NEO4J_CONFIG } from '../src/storage/neo4j/Neo4jConfig.js';
import { logger } from '../src/utils/logger.js';

// Load environment variables from .env file if it exists
dotenv.config();

async function resetNeo4jDatabase(): Promise<void> {
  logger.info('🔄 Starting Neo4j database reset...');
  
  // Create connection manager with environment variables or defaults
  const config = {
    ...DEFAULT_NEO4J_CONFIG,
    uri: process.env.NEO4J_URI || DEFAULT_NEO4J_CONFIG.uri,
    username: process.env.NEO4J_USERNAME || DEFAULT_NEO4J_CONFIG.username,
    password: process.env.NEO4J_PASSWORD || DEFAULT_NEO4J_CONFIG.password,
    database: process.env.NEO4J_DATABASE || DEFAULT_NEO4J_CONFIG.database,
    vectorDimensions: 1536, // Force 1536 dimensions
  };

  const connectionManager = new Neo4jConnectionManager(config);
  const schemaManager = new Neo4jSchemaManager(connectionManager, config, true);

  try {
    // Test connection
    logger.info('📡 Testing Neo4j connection...');
    await connectionManager.executeQuery('RETURN 1', {});
    logger.info('✅ Neo4j connection successful');

    // Step 1: List existing data for awareness
    logger.info('📊 Checking current database state...');
    const nodeCountResult = await connectionManager.executeQuery('MATCH (n) RETURN count(n) as nodeCount', {});
    const relationshipCountResult = await connectionManager.executeQuery('MATCH ()-[r]->() RETURN count(r) as relCount', {});
    const nodeCount = nodeCountResult.records[0]?.get('nodeCount')?.toNumber() || 0;
    const relCount = relationshipCountResult.records[0]?.get('relCount')?.toNumber() || 0;
    
    logger.info(`📈 Current state: ${nodeCount} nodes, ${relCount} relationships`);

    // Step 2: Delete all nodes and relationships
    logger.info('🗑️  Deleting all nodes and relationships...');
    await connectionManager.executeQuery('MATCH (n) DETACH DELETE n', {});
    logger.info('✅ All nodes and relationships deleted');

    // Verify deletion
    const verifyResult = await connectionManager.executeQuery('MATCH (n) RETURN count(n) as count', {});
    const remainingNodes = verifyResult.records[0]?.get('count')?.toNumber() || 0;
    logger.info(`📊 Verification: ${remainingNodes} nodes remaining`);

    // Step 3: List and drop all indexes
    logger.info('🔍 Listing and dropping all indexes...');
    const indexes = await schemaManager.listIndexes();
    logger.info(`📋 Found ${indexes.length} indexes to drop`);
    
    for (const index of indexes) {
      const indexName = index.name as string;
      if (indexName) {
        logger.info(`🗑️  Dropping index: ${indexName}`);
        await schemaManager.dropIndexIfExists(indexName);
      }
    }

    // Also specifically drop the entity_embeddings index if it exists
    logger.info('🗑️  Specifically dropping entity_embeddings index...');
    await schemaManager.dropIndexIfExists('entity_embeddings');

    // Step 4: List and drop all constraints
    logger.info('🔍 Listing and dropping all constraints...');
    const constraints = await schemaManager.listConstraints();
    logger.info(`📋 Found ${constraints.length} constraints to drop`);
    
    for (const constraint of constraints) {
      const constraintName = constraint.name as string;
      if (constraintName) {
        logger.info(`🗑️  Dropping constraint: ${constraintName}`);
        await schemaManager.dropConstraintIfExists(constraintName);
      }
    }

    // Step 5: Verify clean state
    logger.info('🔍 Verifying clean state...');
    const finalIndexes = await schemaManager.listIndexes();
    const finalConstraints = await schemaManager.listConstraints();
    logger.info(`📊 Clean state: ${finalIndexes.length} indexes, ${finalConstraints.length} constraints`);

    // Step 6: Initialize schema with proper dimensions
    logger.info('🏗️  Initializing fresh schema with 1536 dimensions...');
    await schemaManager.initializeSchema(true);
    
    // Step 7: Verify schema creation
    logger.info('🔍 Verifying schema creation...');
    const newIndexes = await schemaManager.listIndexes();
    const newConstraints = await schemaManager.listConstraints();
    logger.info(`📊 New schema: ${newIndexes.length} indexes, ${newConstraints.length} constraints`);

    // Check if vector index exists and is online
    const vectorIndexExists = await schemaManager.vectorIndexExists(config.vectorIndexName);
    logger.info(`📊 Vector index '${config.vectorIndexName}' status: ${vectorIndexExists ? 'ONLINE' : 'NOT FOUND/OFFLINE'}`);

    // Step 8: Display final configuration
    logger.info('📋 Final configuration:');
    logger.info(`   Database: ${config.database}`);
    logger.info(`   Vector Index: ${config.vectorIndexName}`);
    logger.info(`   Vector Dimensions: ${config.vectorDimensions}`);
    logger.info(`   Similarity Function: ${config.similarityFunction}`);

    logger.info('✅ Neo4j database reset completed successfully!');
    
  } catch (error) {
    logger.error('❌ Error during Neo4j reset:', error);
    throw error;
  } finally {
    // Close connections
    await schemaManager.close();
  }
}

// Run the script if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  resetNeo4jDatabase()
    .then(() => {
      logger.info('🎉 Reset script completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      logger.error('💥 Reset script failed:', error);
      process.exit(1);
    });
}

export { resetNeo4jDatabase };