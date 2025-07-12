#!/usr/bin/env node

/**
 * Script to clear old 768-dimensional embeddings from Neo4j entities
 * 
 * Created by Claude Code on 2025-07-12
 * Purpose: Remove all embedding properties from Entity nodes to clear old embeddings 
 * before new 1536-dimensional embeddings are generated
 * Context: Migration script to clean up old embedding format and prepare for new embedding format
 */

import { Neo4jConnectionManager } from '../storage/neo4j/Neo4jConnectionManager.js';
import { DEFAULT_NEO4J_CONFIG } from '../storage/neo4j/Neo4jConfig.js';

async function clearOldEmbeddings(): Promise<void> {
  console.log('Starting cleanup of old embeddings from Neo4j entities...');
  
  // Create connection manager using environment variables or defaults
  const config = {
    uri: process.env.NEO4J_URI || DEFAULT_NEO4J_CONFIG.uri,
    username: process.env.NEO4J_USERNAME || DEFAULT_NEO4J_CONFIG.username,
    password: process.env.NEO4J_PASSWORD || DEFAULT_NEO4J_CONFIG.password,
    database: process.env.NEO4J_DATABASE || DEFAULT_NEO4J_CONFIG.database,
  };

  console.log(`Connecting to Neo4j at: ${config.uri}`);
  console.log(`Database: ${config.database}`);
  console.log(`Username: ${config.username}`);

  const connectionManager = new Neo4jConnectionManager(config);

  try {
    // Execute the Cypher query to remove all embedding properties
    const query = 'MATCH (n:Entity) REMOVE n.embedding RETURN count(n) as entitiesProcessed';
    
    console.log('Executing query to remove embedding properties...');
    console.log(`Query: ${query}`);
    
    const result = await connectionManager.executeQuery(query, {});
    
    // Get the count of processed entities
    const record = result.records[0];
    const entitiesProcessed = record?.get('entitiesProcessed')?.toNumber() || 0;
    
    console.log(`✅ Successfully removed embedding properties from ${entitiesProcessed} entities`);
    console.log('Old embeddings have been cleared. New 1536-dimensional embeddings can now be generated.');
    
  } catch (error) {
    console.error('❌ Error clearing old embeddings:', error);
    process.exit(1);
  } finally {
    // Close the connection
    await connectionManager.close();
    console.log('Neo4j connection closed.');
  }
}

// Run the script if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  clearOldEmbeddings().catch((error) => {
    console.error('❌ Script failed:', error);
    process.exit(1);
  });
}

export { clearOldEmbeddings };