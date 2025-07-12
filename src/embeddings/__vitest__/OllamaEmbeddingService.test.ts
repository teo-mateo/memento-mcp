import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import axios from 'axios';
import { OllamaEmbeddingService } from '../OllamaEmbeddingService.js';
import { logger } from '../../utils/logger.js';

// Mock axios
vi.mock('axios');

describe('OllamaEmbeddingService', () => {
  let service: OllamaEmbeddingService;
  const mockAxios = vi.mocked(axios);

  beforeEach(() => {
    vi.clearAllMocks();
    // Reset environment variables
    delete process.env.OLLAMA_HOST;
    delete process.env.OLLAMA_MODEL;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('constructor', () => {
    it('should use default configuration when no config provided', () => {
      service = new OllamaEmbeddingService();
      const providerInfo = service.getProviderInfo();
      const modelInfo = service.getModelInfo();

      expect(providerInfo.provider).toBe('ollama');
      expect(providerInfo.model).toBe('nomic-embed-text');
      expect(providerInfo.dimensions).toBe(768);
      expect(modelInfo.name).toBe('nomic-embed-text');
      expect(modelInfo.dimensions).toBe(768);
    });

    it('should use custom configuration when provided', () => {
      service = new OllamaEmbeddingService({
        host: 'http://custom:11434',
        model: 'mxbai-embed-large',
        dimensions: 1024,
      });
      const modelInfo = service.getModelInfo();

      expect(modelInfo.name).toBe('mxbai-embed-large');
      expect(modelInfo.dimensions).toBe(1024);
    });

    it('should use environment variables when available', () => {
      process.env.OLLAMA_HOST = 'http://env-host:11434';
      process.env.OLLAMA_MODEL = 'env-model';

      service = new OllamaEmbeddingService();
      const modelInfo = service.getModelInfo();

      expect(modelInfo.name).toBe('env-model');
    });
  });

  describe('generateEmbedding', () => {
    beforeEach(() => {
      service = new OllamaEmbeddingService();
    });

    it('should generate embedding successfully', async () => {
      const mockEmbedding = new Array(768).fill(0).map(() => Math.random());
      mockAxios.post.mockResolvedValueOnce({
        data: { embedding: mockEmbedding },
      });

      const result = await service.generateEmbedding('test text');

      expect(mockAxios.post).toHaveBeenCalledWith(
        'http://localhost:11434/api/embeddings',
        {
          model: 'nomic-embed-text',
          prompt: 'test text',
        },
        {
          headers: { 'Content-Type': 'application/json' },
          timeout: 30000,
        }
      );
      expect(result).toEqual(mockEmbedding);
      expect(result.length).toBe(768);
    });

    it('should handle connection refused error', async () => {
      const error = new Error('connect ECONNREFUSED');
      (error as any).code = 'ECONNREFUSED';
      (error as any).isAxiosError = true;
      mockAxios.post.mockRejectedValueOnce(error);
      mockAxios.isAxiosError = vi.fn().mockReturnValue(true);

      await expect(service.generateEmbedding('test')).rejects.toThrow(
        'Cannot connect to Ollama at http://localhost:11434. Make sure Ollama is running.'
      );
    });

    it('should handle model not found error', async () => {
      const error = new Error('Not found');
      (error as any).response = { status: 404 };
      (error as any).isAxiosError = true;
      mockAxios.post.mockRejectedValueOnce(error);
      mockAxios.isAxiosError = vi.fn().mockReturnValue(true);

      await expect(service.generateEmbedding('test')).rejects.toThrow(
        'Model "nomic-embed-text" not found. Make sure to pull it with: ollama pull nomic-embed-text'
      );
    });

    it('should handle invalid response format', async () => {
      mockAxios.post.mockResolvedValueOnce({
        data: { embedding: 'not-an-array' },
      });

      await expect(service.generateEmbedding('test')).rejects.toThrow(
        'Invalid response from Ollama API: embedding is not an array'
      );
    });

    it('should warn on dimension mismatch', async () => {
      const mockEmbedding = new Array(512).fill(0).map(() => Math.random());
      mockAxios.post.mockResolvedValueOnce({
        data: { embedding: mockEmbedding },
      });

      const loggerWarnSpy = vi.spyOn(logger, 'warn').mockImplementation(() => {});

      const result = await service.generateEmbedding('test text');

      expect(result.length).toBe(512);
      expect(loggerWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Embedding dimension mismatch')
      );

      loggerWarnSpy.mockRestore();
    });
  });

  describe('generateEmbeddings', () => {
    beforeEach(() => {
      service = new OllamaEmbeddingService();
    });

    it('should generate multiple embeddings sequentially', async () => {
      const texts = ['text1', 'text2', 'text3'];
      const mockEmbeddings = texts.map(() =>
        new Array(768).fill(0).map(() => Math.random())
      );

      mockEmbeddings.forEach((embedding, index) => {
        mockAxios.post.mockResolvedValueOnce({
          data: { embedding },
        });
      });

      const results = await service.generateEmbeddings(texts);

      expect(results).toHaveLength(3);
      expect(mockAxios.post).toHaveBeenCalledTimes(3);
      texts.forEach((text, index) => {
        expect(mockAxios.post).toHaveBeenNthCalledWith(
          index + 1,
          'http://localhost:11434/api/embeddings',
          {
            model: 'nomic-embed-text',
            prompt: text,
          },
          expect.any(Object)
        );
      });
    });

    it('should handle errors in batch processing', async () => {
      const texts = ['text1', 'text2'];
      
      // First call succeeds
      mockAxios.post.mockResolvedValueOnce({
        data: { embedding: new Array(768).fill(0.1) },
      });
      
      // Second call fails
      const error = new Error('API Error');
      (error as any).isAxiosError = true;
      mockAxios.post.mockRejectedValueOnce(error);
      mockAxios.isAxiosError = vi.fn().mockReturnValue(true);

      await expect(service.generateEmbeddings(texts)).rejects.toThrow('Ollama API error: API Error');
      expect(mockAxios.post).toHaveBeenCalledTimes(2);
    });

    it('should log progress for large batches', async () => {
      const texts = new Array(15).fill('text');
      const mockEmbedding = new Array(768).fill(0.1);

      texts.forEach(() => {
        mockAxios.post.mockResolvedValueOnce({
          data: { embedding: mockEmbedding },
        });
      });

      const loggerDebugSpy = vi.spyOn(logger, 'debug').mockImplementation(() => {});

      await service.generateEmbeddings(texts);

      // Should log at 10 and finish
      expect(loggerDebugSpy).toHaveBeenCalledWith(
        expect.stringContaining('Generated 10/15 embeddings')
      );

      loggerDebugSpy.mockRestore();
    });
  });
});