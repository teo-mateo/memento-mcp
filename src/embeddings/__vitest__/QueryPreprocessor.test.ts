/**
 * QueryPreprocessor Unit Tests - Created by Claude Code on 2025-07-12
 * Purpose: Test multi-term query analysis and preprocessing functionality
 * Context: Validates query complexity analysis, adaptive thresholding, and decomposition features
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { QueryPreprocessor, QueryPreprocessorOptions, QueryAnalysis } from '../QueryPreprocessor';

describe('QueryPreprocessor', () => {
  let preprocessor: QueryPreprocessor;

  beforeEach(() => {
    preprocessor = new QueryPreprocessor();
  });

  describe('constructor', () => {
    it('should use default options when none provided', () => {
      const analysis = preprocessor.analyze('test');
      expect(analysis.recommendedThreshold).toBeLessThanOrEqual(0.6);
      expect(analysis.recommendedThreshold).toBeGreaterThanOrEqual(0.4);
    });

    it('should respect custom options', () => {
      const customOptions: QueryPreprocessorOptions = {
        enableDecomposition: false,
        complexityThreshold: 5,
        adaptiveThresholds: false,
        minThresholdMultiTerm: 0.3,
        maxThresholdSingleTerm: 0.7,
      };
      
      const customPreprocessor = new QueryPreprocessor(customOptions);
      const analysis = customPreprocessor.analyze('test query');
      
      expect(analysis.subQueries).toHaveLength(1); // No decomposition
      expect(analysis.recommendedThreshold).toBe(0.7); // No adaptive threshold
    });
  });

  describe('analyze', () => {
    it('should analyze single-term queries correctly', () => {
      const analysis = preprocessor.analyze('rabbit');
      
      expect(analysis.originalQuery).toBe('rabbit');
      expect(analysis.normalizedQuery).toBe('rabbit');
      expect(analysis.terms).toEqual(['rabbit']);
      expect(analysis.complexity).toBe(0);
      expect(analysis.recommendedThreshold).toBe(0.6);
      expect(analysis.useMultiVector).toBe(false);
      expect(analysis.keyTerms).toEqual(['rabbit']);
    });

    it('should analyze multi-term queries correctly', () => {
      const analysis = preprocessor.analyze('programmer developer coding');
      
      expect(analysis.originalQuery).toBe('programmer developer coding');
      expect(analysis.normalizedQuery).toBe('programmer developer coding');
      expect(analysis.terms).toEqual(['programmer', 'developer', 'coding']);
      expect(analysis.complexity).toBe(1);
      expect(analysis.recommendedThreshold).toBe(0.4);
      expect(analysis.useMultiVector).toBe(true);
      expect(analysis.keyTerms).toEqual(['programmer', 'developer', 'coding']);
    });

    it('should handle queries with extra whitespace', () => {
      const analysis = preprocessor.analyze('  javascript   web   development  ');
      
      expect(analysis.normalizedQuery).toBe('javascript web development');
      expect(analysis.terms).toEqual(['javascript', 'web', 'development']);
    });

    it('should convert to lowercase', () => {
      const analysis = preprocessor.analyze('AngularJS JavaScript TypeScript');
      
      expect(analysis.normalizedQuery).toBe('angularjs javascript typescript');
      expect(analysis.terms).toEqual(['angularjs', 'javascript', 'typescript']);
    });
  });

  describe('analyzeComplexity', () => {
    it('should return 0 for single terms', () => {
      const complexity = preprocessor.analyzeComplexity(['rabbit']);
      expect(complexity).toBe(0);
    });

    it('should return 1 for queries at or above complexity threshold', () => {
      const complexity = preprocessor.analyzeComplexity(['term1', 'term2', 'term3']);
      expect(complexity).toBe(1);
    });

    it('should scale linearly for intermediate complexity', () => {
      const complexity = preprocessor.analyzeComplexity(['term1', 'term2']);
      expect(complexity).toBe(0.5);
    });

    it('should handle custom complexity thresholds', () => {
      const customPreprocessor = new QueryPreprocessor({ complexityThreshold: 5 });
      const complexity = customPreprocessor.analyzeComplexity(['t1', 't2', 't3']);
      expect(complexity).toBe(0.5); // (3-1)/(5-1) = 0.5
    });
  });

  describe('decomposeQuery', () => {
    it('should not decompose queries with less than 3 terms', () => {
      const subQueries = preprocessor.decomposeQuery('javascript development', ['javascript', 'development']);
      expect(subQueries).toEqual(['javascript development']);
    });

    it('should create bigrams for 3+ term queries', () => {
      const subQueries = preprocessor.decomposeQuery(
        'javascript web development',
        ['javascript', 'web', 'development']
      );
      
      expect(subQueries).toContain('javascript web development');
      expect(subQueries).toContain('javascript web');
      expect(subQueries).toContain('web development');
      expect(subQueries).toContain('javascript');
      expect(subQueries).toContain('development');
    });

    it('should include significant terms (5+ chars)', () => {
      const subQueries = preprocessor.decomposeQuery(
        'go programming language',
        ['go', 'programming', 'language']
      );
      
      expect(subQueries).toContain('programming');
      expect(subQueries).toContain('language');
      expect(subQueries).not.toContain('go'); // Too short
    });

    it('should remove duplicates', () => {
      const subQueries = preprocessor.decomposeQuery(
        'test test testing',
        ['test', 'test', 'testing']
      );
      
      const uniqueSubQueries = [...new Set(subQueries)];
      expect(subQueries.length).toBe(uniqueSubQueries.length);
    });
  });

  describe('calculateAdaptiveThreshold', () => {
    it('should return max threshold for zero complexity', () => {
      const threshold = preprocessor.calculateAdaptiveThreshold(0);
      expect(threshold).toBe(0.6);
    });

    it('should return min threshold for max complexity', () => {
      const threshold = preprocessor.calculateAdaptiveThreshold(1);
      expect(threshold).toBe(0.4);
    });

    it('should interpolate linearly for intermediate complexity', () => {
      const threshold = preprocessor.calculateAdaptiveThreshold(0.5);
      expect(threshold).toBe(0.5); // Midpoint between 0.4 and 0.6
    });

    it('should respect custom thresholds', () => {
      const customPreprocessor = new QueryPreprocessor({
        minThresholdMultiTerm: 0.3,
        maxThresholdSingleTerm: 0.8,
      });
      
      const threshold = customPreprocessor.calculateAdaptiveThreshold(0.5);
      expect(threshold).toBe(0.55); // Midpoint between 0.3 and 0.8
    });

    it('should return max threshold when adaptive thresholds disabled', () => {
      const customPreprocessor = new QueryPreprocessor({
        adaptiveThresholds: false,
      });
      
      const threshold = customPreprocessor.calculateAdaptiveThreshold(1);
      expect(threshold).toBe(0.6);
    });
  });

  describe('shouldUseMultiVector', () => {
    it('should return false for queries with less than 3 terms', () => {
      expect(preprocessor.shouldUseMultiVector(['term1'])).toBe(false);
      expect(preprocessor.shouldUseMultiVector(['term1', 'term2'])).toBe(false);
    });

    it('should return true for queries with 3+ terms', () => {
      expect(preprocessor.shouldUseMultiVector(['term1', 'term2', 'term3'])).toBe(true);
      expect(preprocessor.shouldUseMultiVector(['t1', 't2', 't3', 't4'])).toBe(true);
    });
  });

  describe('extractKeyTerms', () => {
    it('should filter out stop words', () => {
      const analysis = preprocessor.analyze('the rabbit and the developer');
      expect(analysis.keyTerms).toEqual(['developer', 'rabbit']);
    });

    it('should filter out short terms', () => {
      const analysis = preprocessor.analyze('go is a programming language');
      expect(analysis.keyTerms).toEqual(['programming', 'language']);
    });

    it('should sort by length (longest first)', () => {
      const analysis = preprocessor.analyze('web javascript programming');
      expect(analysis.keyTerms).toEqual(['programming', 'javascript', 'web']);
    });
  });

  describe('generateFallbackPatterns', () => {
    it('should include original key terms', () => {
      const patterns = preprocessor.generateFallbackPatterns(['rabbit', 'developer']);
      expect(patterns).toContain('rabbit');
      expect(patterns).toContain('developer');
    });

    it('should add partial matches for long terms', () => {
      const patterns = preprocessor.generateFallbackPatterns(['programming']);
      expect(patterns).toContain('prog.*');
    });

    it('should add common suffixes', () => {
      const patterns = preprocessor.generateFallbackPatterns(['develop']);
      expect(patterns).toContain('develops?');
      expect(patterns).toContain('developing');
      expect(patterns).toContain('developed');
    });

    it('should remove duplicates', () => {
      const patterns = preprocessor.generateFallbackPatterns(['test', 'test']);
      const uniquePatterns = [...new Set(patterns)];
      expect(patterns.length).toBe(uniquePatterns.length);
    });

    it('should not add partial matches for short terms', () => {
      const patterns = preprocessor.generateFallbackPatterns(['web']);
      expect(patterns).not.toContain('web.*');
    });
  });

  describe('integration scenarios', () => {
    it('should handle complex technical queries', () => {
      const analysis = preprocessor.analyze('AngularJS JavaScript web development framework');
      
      expect(analysis.complexity).toBe(1);
      expect(analysis.recommendedThreshold).toBeLessThan(0.6);
      expect(analysis.useMultiVector).toBe(true);
      expect(analysis.subQueries).toContain('angularjs javascript');
      expect(analysis.subQueries).toContain('javascript web');
      expect(analysis.subQueries).toContain('web development');
      expect(analysis.subQueries).toContain('development framework');
      expect(analysis.keyTerms).toContain('javascript');
      expect(analysis.keyTerms).toContain('development');
      expect(analysis.keyTerms).toContain('framework');
    });

    it('should handle database-related queries', () => {
      const analysis = preprocessor.analyze('database SQL NoSQL MongoDB PostgreSQL');
      
      expect(analysis.complexity).toBe(1);
      expect(analysis.useMultiVector).toBe(true);
      expect(analysis.keyTerms).toContain('database');
      expect(analysis.keyTerms).toContain('mongodb');
      expect(analysis.keyTerms).toContain('postgresql');
    });

    it('should handle machine learning queries', () => {
      const analysis = preprocessor.analyze('machine learning AI artificial intelligence');
      
      expect(analysis.complexity).toBe(1);
      expect(analysis.useMultiVector).toBe(true);
      expect(analysis.subQueries).toContain('machine learning');
      expect(analysis.subQueries).toContain('artificial intelligence');
      expect(analysis.keyTerms).toContain('artificial');
      expect(analysis.keyTerms).toContain('intelligence');
      expect(analysis.keyTerms).toContain('learning');
      expect(analysis.keyTerms).toContain('machine');
    });
  });
});