/**
 * QueryPreprocessor - Created by Claude Code on 2025-07-12
 * Purpose: Analyze and preprocess multi-term queries for improved semantic search
 * Context: Addresses issues with high similarity thresholds and poor fallback mechanisms in multi-term queries
 */

export interface QueryPreprocessorOptions {
  /**
   * Enable query decomposition into sub-queries
   * @default true
   */
  enableDecomposition?: boolean;

  /**
   * Threshold for determining query complexity (based on term count)
   * @default 3
   */
  complexityThreshold?: number;

  /**
   * Enable adaptive thresholds based on query complexity
   * @default true
   */
  adaptiveThresholds?: boolean;

  /**
   * Minimum similarity threshold for multi-term queries
   * @default 0.4
   */
  minThresholdMultiTerm?: number;

  /**
   * Maximum similarity threshold for single-term queries
   * @default 0.6
   */
  maxThresholdSingleTerm?: number;
}

export interface QueryAnalysis {
  /**
   * Original query string
   */
  originalQuery: string;

  /**
   * Cleaned and normalized query
   */
  normalizedQuery: string;

  /**
   * Individual terms extracted from the query
   */
  terms: string[];

  /**
   * Decomposed sub-queries for compound concepts
   */
  subQueries: string[];

  /**
   * Complexity score (0-1) based on term count and structure
   */
  complexity: number;

  /**
   * Recommended similarity threshold based on complexity
   */
  recommendedThreshold: number;

  /**
   * Whether to use multiple embeddings for this query
   */
  useMultiVector: boolean;

  /**
   * Key terms that should be used for fallback patterns
   */
  keyTerms: string[];
}

export class QueryPreprocessor {
  private options: Required<QueryPreprocessorOptions>;

  constructor(options: QueryPreprocessorOptions = {}) {
    this.options = {
      enableDecomposition: options.enableDecomposition ?? true,
      complexityThreshold: options.complexityThreshold ?? 3,
      adaptiveThresholds: options.adaptiveThresholds ?? true,
      minThresholdMultiTerm: options.minThresholdMultiTerm ?? 0.4,
      maxThresholdSingleTerm: options.maxThresholdSingleTerm ?? 0.6,
    };
  }

  /**
   * Analyze a query and return preprocessing recommendations
   */
  analyze(query: string): QueryAnalysis {
    const normalizedQuery = this.normalizeQuery(query);
    const terms = this.extractTerms(normalizedQuery);
    const complexity = this.analyzeComplexity(terms);
    const subQueries = this.options.enableDecomposition
      ? this.decomposeQuery(normalizedQuery, terms)
      : [normalizedQuery];
    const recommendedThreshold = this.calculateAdaptiveThreshold(complexity);
    const useMultiVector = this.shouldUseMultiVector(terms);
    const keyTerms = this.extractKeyTerms(terms);

    return {
      originalQuery: query,
      normalizedQuery,
      terms,
      subQueries,
      complexity,
      recommendedThreshold,
      useMultiVector,
      keyTerms,
    };
  }

  /**
   * Analyze query complexity based on term count and structure
   * @returns Complexity score between 0 and 1
   */
  analyzeComplexity(terms: string[]): number {
    const termCount = terms.length;

    // Simple linear scaling based on term count
    if (termCount <= 1) return 0;
    if (termCount >= this.options.complexityThreshold) return 1;

    return (termCount - 1) / (this.options.complexityThreshold - 1);
  }

  /**
   * Decompose a query into sub-queries for compound concepts
   */
  decomposeQuery(query: string, terms: string[]): string[] {
    const subQueries: string[] = [query];

    // If query has 3+ terms, create bigrams
    if (terms.length >= 3) {
      // Add bigram combinations
      for (let i = 0; i < terms.length - 1; i++) {
        subQueries.push(`${terms[i]} ${terms[i + 1]}`);
      }

      // Add individual high-value terms (longer terms are often more specific)
      const significantTerms = terms.filter((term) => term.length >= 5);
      subQueries.push(...significantTerms);
    }

    // Remove duplicates
    return [...new Set(subQueries)];
  }

  /**
   * Calculate adaptive threshold based on query complexity
   */
  calculateAdaptiveThreshold(complexity: number): number {
    if (!this.options.adaptiveThresholds) {
      return this.options.maxThresholdSingleTerm;
    }

    // Linear interpolation between max and min thresholds
    const range = this.options.maxThresholdSingleTerm - this.options.minThresholdMultiTerm;
    return this.options.maxThresholdSingleTerm - complexity * range;
  }

  /**
   * Determine if multiple embeddings should be used for this query
   */
  shouldUseMultiVector(terms: string[]): boolean {
    // Use multi-vector for queries with 3+ terms or compound concepts
    return terms.length >= 3;
  }

  /**
   * Extract key terms for fallback pattern generation
   */
  private extractKeyTerms(terms: string[]): string[] {
    // Filter out common stop words and short terms
    const stopWords = new Set([
      'the',
      'a',
      'an',
      'and',
      'or',
      'but',
      'in',
      'on',
      'at',
      'to',
      'for',
    ]);

    return terms
      .filter((term) => !stopWords.has(term.toLowerCase()) && term.length > 2)
      .sort((a, b) => b.length - a.length); // Longer terms first
  }

  /**
   * Normalize query by trimming and collapsing whitespace
   */
  private normalizeQuery(query: string): string {
    return query.trim().replace(/\s+/g, ' ').toLowerCase();
  }

  /**
   * Extract individual terms from the query
   */
  private extractTerms(query: string): string[] {
    // Split on whitespace and filter out empty strings
    return query.split(/\s+/).filter((term) => term.length > 0);
  }

  /**
   * Generate enhanced fallback patterns from query terms
   */
  generateFallbackPatterns(keyTerms: string[]): string[] {
    const patterns: string[] = [];

    // Add individual key terms
    patterns.push(...keyTerms);

    // Add common variations
    for (const term of keyTerms) {
      // Add partial matches
      if (term.length > 4) {
        patterns.push(`${term.substring(0, 4)}.*`);
      }

      // Add common suffixes
      patterns.push(`${term}s?`); // Plural
      patterns.push(`${term}ing`); // Gerund
      patterns.push(`${term}ed`); // Past tense
    }

    // Remove duplicates and return
    return [...new Set(patterns)];
  }
}
