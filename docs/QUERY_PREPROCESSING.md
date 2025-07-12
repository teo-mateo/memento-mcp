# Query Preprocessing for Semantic Search
*Created by Claude Code on 2025-07-12*

## Overview

The Query Preprocessing feature enhances semantic search capabilities for multi-term queries by implementing:
- Adaptive similarity thresholds based on query complexity
- Query normalization and analysis
- Intelligent threshold adjustment for better recall

## Configuration

The feature is controlled by the `ENABLE_QUERY_PREPROCESSING` environment variable:

```bash
# Enable query preprocessing (default: false)
ENABLE_QUERY_PREPROCESSING=true
```

When disabled (default), the system maintains original behavior with fixed similarity thresholds.

## How It Works

### Query Complexity Analysis
- **Single terms**: Complexity = 0, uses maximum threshold (0.6)
- **Multi-terms**: Complexity scales from 0 to 1 based on term count
- **Adaptive threshold**: Interpolates between 0.6 (single) and 0.4 (multi-term)

### Example Improvements

Without preprocessing:
- Query: "programmer developer coding" → 0 results (threshold too high)
- Query: "database SQL NoSQL" → 0 results

With preprocessing enabled:
- Query: "programmer developer coding" → Finds programming-related entities
- Query: "database SQL NoSQL" → Finds database-related entities

### Search Options

You can customize preprocessing behavior through search options:

```typescript
const results = await semanticSearch("multi term query", {
  enableAdaptiveThresholds: true,  // Use adaptive thresholds (default: true)
  queryPreprocessing: {
    minThresholdMultiTerm: 0.4,    // Min threshold for complex queries
    maxThresholdSingleTerm: 0.6,   // Max threshold for simple queries
    complexityThreshold: 3,         // Terms needed for max complexity
  }
});
```

## Benefits

1. **Better Multi-Term Search**: Complex queries that previously returned no results now find relevant entities
2. **Backwards Compatible**: Disabled by default, preserving existing behavior
3. **Configurable**: Fine-tune thresholds based on your data and use case
4. **Transparent**: Debug mode shows preprocessing decisions in diagnostics

## Testing

Run integration tests with query preprocessing:

```bash
# Enable preprocessing and run tests
ENABLE_QUERY_PREPROCESSING=true TEST_INTEGRATION=true npm test src/storage/neo4j/__vitest__/Neo4jQueryPreprocessing.test.ts
```

## Implementation Details

The `QueryPreprocessor` class analyzes queries to:
1. Normalize whitespace and case
2. Calculate complexity based on term count
3. Recommend appropriate similarity thresholds
4. Extract key terms for enhanced fallback patterns (future feature)

This preprocessing occurs before embedding generation, ensuring the normalized query is used consistently throughout the search pipeline.