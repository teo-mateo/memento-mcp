# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Memento MCP is a sophisticated knowledge graph memory system that provides LLM clients with persistent, semantic memory capabilities through the Model Context Protocol. It combines Neo4j graph storage with vector embeddings for semantic search and temporal awareness, featuring a robust architecture for enterprise-grade knowledge management.

## Core Architecture

### Knowledge Graph Manager (`src/KnowledgeGraphManager.ts`)
Central orchestrator managing all graph operations with pluggable storage backends:
- **Entity Management**: CRUD operations with automatic embedding generation
- **Relation Management**: Enhanced relations with strength, confidence, and metadata
- **Semantic Search**: Vector similarity with hybrid keyword/semantic search
- **Temporal Operations**: Complete version history and point-in-time queries
- **Confidence Decay**: Time-based relation confidence degradation

### Storage Layer Architecture

#### Neo4j Storage Provider (`src/storage/neo4j/`)
Primary storage implementation with comprehensive features:
- **Neo4jStorageProvider**: Main implementation with temporal versioning
- **Neo4jConnectionManager**: Connection pooling and session management
- **Neo4jSchemaManager**: Index and constraint management
- **Neo4jVectorStore**: Native vector search integration
- **ExtendedEntity/Relation**: Temporal metadata with version tracking

#### Storage Provider Interface (`src/storage/StorageProvider.ts`)
Extensible interface with optional methods for advanced features:
- Required: Basic CRUD operations (loadGraph, saveGraph, createEntities, etc.)
- Optional: Temporal features (getEntityHistory, getGraphAtTime, getDecayedGraph)
- Optional: Vector operations (updateEntityEmbedding, findSimilarEntities, semanticSearch)
- Validation: StorageProviderValidator class for runtime type checking

### Embedding System Architecture

#### Job Management (`src/embeddings/EmbeddingJobManager.ts`)
Sophisticated background processing system:
- **Job Queue**: Database-backed job persistence with status tracking
- **Rate Limiting**: Token bucket algorithm for API rate compliance
- **Caching**: LRU cache for embedding reuse and performance
- **Error Handling**: Retry logic with exponential backoff
- **Priority Processing**: Configurable job priority levels

#### Embedding Services (`src/embeddings/`)
Factory pattern with multiple providers:
- **EmbeddingServiceFactory**: Provider registry and environment-based selection
- **OpenAIEmbeddingService**: Production-ready OpenAI API integration
- **AzureEmbeddingService**: Azure OpenAI Service integration with deployment support
- **DefaultEmbeddingService**: Mock service for testing with random vectors
- **Rate Limiting**: Configurable API limits with automatic throttling

### Temporal Data Models

#### Temporal Entities (`src/types/temporalEntity.ts`)
Complete version tracking for entities:
- **Core Fields**: id, version, createdAt, updatedAt
- **Validity Periods**: validFrom, validTo for time-based filtering
- **Change Tracking**: changedBy for audit trails
- **Validation**: TemporalEntityValidator with comprehensive checks

#### Temporal Relations (`src/types/temporalRelation.ts`)
Enhanced relations with temporal awareness:
- **Extends Relation**: Full relation functionality with time tracking
- **Version Management**: Non-destructive updates with history preservation
- **Validity Checking**: Runtime validation for temporal consistency
- **Confidence Decay**: Time-based confidence degradation calculations

#### Advanced Relation Features (`src/types/relation.ts`)
Rich metadata and validation:
- **Strength/Confidence**: Numeric scores (0.0-1.0) for relation quality
- **Metadata**: Structured data with timestamps and inference tracking
- **Validation**: RelationValidator with comprehensive type checking

### Vector Search Architecture

#### Entity Embeddings (`src/types/entity-embedding.ts`)
Comprehensive semantic search capabilities:
- **EntityEmbedding**: Vector storage with model and timestamp metadata
- **SemanticSearchOptions**: Extensive configuration for search behavior
- **Hybrid Search**: Balanced keyword and vector similarity search
- **Advanced Filtering**: Multi-field filters with operators
- **Search Results**: Detailed scoring and explanation support

#### Vector Store Implementation (`src/storage/neo4j/Neo4jVectorStore.ts`)
Neo4j-native vector operations:
- **Index Management**: Automatic vector index creation and management
- **Similarity Functions**: Cosine and Euclidean distance support
- **Batch Operations**: Efficient bulk vector updates
- **Error Handling**: Graceful fallbacks for missing embeddings

## MCP Integration

### Tool Handler Architecture (`src/server/handlers/`)
Modular tool implementation with comprehensive API:

#### Core Operations
- **Entity Management**: create_entities, add_observations, delete_entities, delete_observations
- **Relation Management**: create_relations, get_relation, update_relation, delete_relations
- **Graph Operations**: read_graph, search_nodes, open_nodes

#### Semantic Search Tools
- **semantic_search**: Advanced vector similarity with hybrid options
- **get_entity_embedding**: Direct embedding access for debugging

#### Temporal Tools
- **get_entity_history**: Complete version history for entities
- **get_relation_history**: Relation version tracking
- **get_graph_at_time**: Point-in-time graph reconstruction
- **get_decayed_graph**: Confidence decay calculations

#### Debug Tools (DEBUG=true only)
- **force_generate_embedding**: Manual embedding generation
- **debug_embedding_config**: Configuration diagnostics
- **diagnose_vector_search**: Vector search debugging

### MCP Server Setup (`src/server/setup.ts`)
- **Server Configuration**: Capabilities and tool registration
- **Error Handling**: Comprehensive error propagation
- **Request Routing**: Tool name-based request dispatch

## Development Commands

### Build and Development
```bash
npm run build          # TypeScript compilation to dist/
npm run dev            # Watch mode for development
npm run prepare        # Build hook (runs on install)
```

### Testing Strategy
```bash
npm test              # Run all Vitest tests
npm run test:watch    # Watch mode testing
npm run test:coverage # Generate coverage reports
npm run test:verbose  # Detailed test output
npm run test:integration  # Integration tests (requires TEST_INTEGRATION=true)
```

### Code Quality
```bash
npm run lint          # ESLint with TypeScript rules
npm run lint:fix      # Auto-fix linting issues
npm run format        # Prettier code formatting
npm run fix           # Combined lint and format
```

### Neo4j Operations
```bash
npm run neo4j:init    # Initialize schema (development/troubleshooting)
npm run neo4j:test    # Test database connection
```

## Configuration Management

### Environment Variables
Comprehensive configuration through environment variables:

#### Neo4j Connection
- `NEO4J_URI`: Database connection string (default: bolt://localhost:7687)
- `NEO4J_USERNAME`: Database username (default: neo4j)
- `NEO4J_PASSWORD`: Database password (default: memento_password)
- `NEO4J_DATABASE`: Database name (default: neo4j)

#### Vector Search Configuration
- `NEO4J_VECTOR_INDEX`: Vector index name (default: entity_embeddings)
- `NEO4J_VECTOR_DIMENSIONS`: Embedding dimensions (default: 1536)
- `NEO4J_SIMILARITY_FUNCTION`: Similarity function (cosine/euclidean)

#### Embedding Service
- `OPENAI_API_KEY`: OpenAI API key for embeddings
- `OPENAI_EMBEDDING_MODEL`: Model selection (default: text-embedding-3-small)
- `AZURE_OPENAI_API_KEY`: Azure OpenAI API key (preferred if provided)
- `AZURE_OPENAI_ENDPOINT`: Azure OpenAI endpoint URL
- `AZURE_OPENAI_DEPLOYMENT`: Azure OpenAI deployment name
- `AZURE_OPENAI_API_VERSION`: Azure API version (default: 2023-05-15)
- `AZURE_OPENAI_MODEL`: Azure model name (default: text-embedding-ada-002)
- `MOCK_EMBEDDINGS`: Use mock embeddings for testing
- `EMBEDDING_RATE_LIMIT_TOKENS`: Rate limiting configuration
- `EMBEDDING_RATE_LIMIT_INTERVAL`: Rate limiting interval

#### System Configuration
- `MEMORY_STORAGE_TYPE`: Storage backend (always neo4j)
- `DEBUG`: Enable debug tools and verbose logging

### Configuration Factory (`src/config/storage.ts`)
- **Storage Type Determination**: Forced to Neo4j for consistency
- **Environment Variable Processing**: Type-safe configuration parsing
- **Factory Pattern**: Centralized provider instantiation

## Testing Architecture

### Test Organization
All tests use Vitest framework with systematic organization:
- **Location**: Tests in `**/__vitest__/` directories
- **Types**: Unit tests, integration tests, and benchmark tests
- **Mocking**: Comprehensive mocking for external dependencies
- **Coverage**: Extensive coverage requirements with thresholds

### Test Patterns
- **Mock Providers**: Comprehensive storage provider mocking
- **Type Validation**: Runtime type checking with validator classes
- **Integration Tests**: Real Neo4j database testing with proper setup/teardown
- **Error Testing**: Comprehensive error condition coverage

### Key Test Areas
- **Storage Provider Compliance**: Interface validation and behavior testing
- **Embedding System**: Job processing, rate limiting, and caching
- **Temporal Consistency**: Version tracking and point-in-time queries
- **Vector Search**: Accuracy and performance testing
- **MCP Protocol**: Tool handler validation and response formatting

## Advanced Features Implementation

### Confidence Decay System
Time-based confidence degradation with configurable parameters:
- **Half-Life Calculation**: Exponential decay with customizable half-life
- **Minimum Thresholds**: Prevent over-decay of important relations
- **Reference Time Flexibility**: Calculate decay from arbitrary timestamps
- **Non-Destructive**: Original confidence preserved alongside decayed values

### Semantic Search Intelligence
Adaptive search with automatic optimization:
- **Query Analysis**: Automatic selection of optimal search strategy
- **Fallback Mechanisms**: Graceful degradation when embeddings unavailable
- **Performance Optimization**: Intelligent caching and query optimization
- **Hybrid Weighting**: Configurable balance between semantic and keyword search

### Performance Optimizations
- **Connection Pooling**: Efficient Neo4j connection management
- **Batch Processing**: Bulk operations for improved throughput
- **Caching Layers**: Multi-level caching for frequent operations
- **Index Optimization**: Proper indexing for large graph operations

## Implementation Patterns

### Error Handling
Comprehensive error management throughout the system:
- **Graceful Fallbacks**: System continues operating when components fail
- **Detailed Logging**: Structured logging with context information
- **Type Safety**: Runtime validation with detailed error messages
- **Recovery Mechanisms**: Automatic retry and recovery strategies

### Type Safety
Strict TypeScript implementation with runtime validation:
- **Interface Compliance**: Validator classes for runtime type checking
- **Generic Types**: Flexible typing for extensibility
- **Optional Method Handling**: Safe optional method invocation
- **Type Guards**: Comprehensive type guard functions

### Extensibility Patterns
- **Factory Pattern**: Pluggable providers and services
- **Interface Segregation**: Optional methods for feature extensibility
- **Configuration-Driven**: Environment-based feature toggling
- **Modular Architecture**: Independent, testable components

## Key Files for Development

### Core Implementation
- `src/KnowledgeGraphManager.ts`: Main API and orchestration
- `src/storage/neo4j/Neo4jStorageProvider.ts`: Primary storage implementation
- `src/embeddings/EmbeddingJobManager.ts`: Background processing engine

### Type Definitions
- `src/types/temporalEntity.ts`: Temporal entity models
- `src/types/temporalRelation.ts`: Temporal relation models
- `src/types/entity-embedding.ts`: Vector search types

### MCP Integration
- `src/server/handlers/callToolHandler.ts`: Main request router
- `src/server/handlers/listToolsHandler.ts`: Tool schema definitions
- `src/server/handlers/toolHandlers/`: Individual tool implementations

### Configuration
- `src/config/storage.ts`: Storage provider configuration
- `src/storage/neo4j/Neo4jConfig.ts`: Neo4j-specific settings

### Testing
- `src/__vitest__/`: Core functionality tests
- `src/storage/__vitest__/neo4j/`: Neo4j integration tests
- `src/embeddings/__vitest__/`: Embedding system tests