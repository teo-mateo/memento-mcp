# Neo4j Database Management Scripts

This directory contains utility scripts for managing the Neo4j database used by Memento MCP.

## Available Scripts

### 1. Database Reset (`reset-neo4j.ts`)

**Purpose**: Completely resets the Neo4j database to a clean state with proper configuration.

**What it does**:
- Connects to Neo4j using the existing connection manager
- Deletes all nodes and relationships
- Drops all indexes (including vector indexes)
- Drops all constraints
- Reinitializes the schema with proper 1536 dimensions

**Usage**:
```bash
npm run neo4j:reset
```

**When to use**:
- When you have dimension mismatch issues with vector embeddings
- To start with a completely clean database
- After major schema changes
- When troubleshooting persistent database issues

### 2. Schema Verification (`verify-neo4j-schema.ts`)

**Purpose**: Verifies the current state of the Neo4j database schema.

**What it shows**:
- Current node and relationship counts
- All constraints in the database
- All indexes in the database
- Vector index status and configuration
- Expected vs actual configuration

**Usage**:
```bash
npm run neo4j:verify
```

**When to use**:
- After running the reset script
- To check if schema is properly configured
- For troubleshooting database issues
- To verify vector index dimensions

## Environment Variables

Both scripts respect the following environment variables:

- `NEO4J_URI` - Neo4j server URI (default: bolt://localhost:7687)
- `NEO4J_USERNAME` - Username (default: neo4j)
- `NEO4J_PASSWORD` - Password (default: memento_password)
- `NEO4J_DATABASE` - Database name (default: neo4j)
- `NEO4J_VECTOR_INDEX` - Vector index name (default: entity_embeddings)
- `NEO4J_VECTOR_DIMENSIONS` - Vector dimensions (default: 1536)
- `NEO4J_SIMILARITY_FUNCTION` - Similarity function (default: cosine)

You can set these in a `.env` file or as environment variables.

## Example Workflow

1. **Reset the database**:
   ```bash
   npm run neo4j:reset
   ```

2. **Verify the schema**:
   ```bash
   npm run neo4j:verify
   ```

3. **Test the connection**:
   ```bash
   npm run neo4j:test
   ```

## Troubleshooting

### Common Issues

1. **Connection Failed**: Check that Neo4j is running and the connection parameters are correct.

2. **Permission Denied**: Ensure the Neo4j user has proper permissions to create/drop indexes and constraints.

3. **Dimension Mismatch**: Run the reset script to ensure all vector indexes use 1536 dimensions.

### Debug Mode

Both scripts provide detailed debug output by default. Look for `[DEBUG]` messages to understand what operations are being performed.

## Safety Notes

⚠️ **Warning**: The reset script will **permanently delete all data** in your Neo4j database. Use with caution!

- Always backup important data before running the reset script
- The reset operation cannot be undone
- Make sure you're connected to the correct database instance

## Script Details

### Created by Claude Code

These scripts were created by Claude Code on 2025-07-12 to provide comprehensive Neo4j database management capabilities for the Memento MCP project. They use the existing connection manager and schema manager classes to ensure consistency with the main application.