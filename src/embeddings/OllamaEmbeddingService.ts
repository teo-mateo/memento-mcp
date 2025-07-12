import axios from 'axios';
import {
  EmbeddingService,
  type EmbeddingModelInfo,
  type EmbeddingProviderInfo,
} from './EmbeddingService.js';
import { logger } from '../utils/logger.js';

/**
 * Configuration for Ollama embedding service
 */
export interface OllamaEmbeddingConfig {
  /**
   * Ollama host URL
   */
  host?: string;

  /**
   * Model name to use for embeddings
   */
  model?: string;

  /**
   * Optional dimensions override
   */
  dimensions?: number;

  /**
   * Optional version string
   */
  version?: string;
}

/**
 * Ollama API response structure for embeddings
 */
interface OllamaEmbeddingResponse {
  embedding: number[];
}

/**
 * Service implementation that generates embeddings using Ollama's local API
 */
export class OllamaEmbeddingService extends EmbeddingService {
  private host: string;
  private model: string;
  private dimensions: number;
  private version: string;
  private apiEndpoint: string;

  /**
   * Create a new Ollama embedding service
   *
   * @param config - Configuration for the service
   */
  constructor(config: OllamaEmbeddingConfig = {}) {
    super();

    this.host = config.host || process.env.OLLAMA_HOST || 'http://localhost:11434';
    this.model = config.model || process.env.OLLAMA_MODEL || 'nomic-embed-text';
    this.dimensions = config.dimensions || 768; // nomic-embed-text default
    this.version = config.version || '1.0.0';
    this.apiEndpoint = `${this.host}/api/embeddings`;

    logger.info('OllamaEmbeddingService initialized', {
      host: this.host,
      model: this.model,
      dimensions: this.dimensions,
    });
  }

  /**
   * Generate an embedding for a single text
   *
   * @param text - Text to generate embedding for
   * @returns Promise resolving to embedding vector
   */
  override async generateEmbedding(text: string): Promise<number[]> {
    logger.debug('Generating Ollama embedding', {
      text: text.substring(0, 50) + '...',
      model: this.model,
      apiEndpoint: this.apiEndpoint,
    });

    try {
      const response = await axios.post<OllamaEmbeddingResponse>(
        this.apiEndpoint,
        {
          model: this.model,
          prompt: text,
        },
        {
          headers: {
            'Content-Type': 'application/json',
          },
          timeout: 30000, // 30 second timeout
        }
      );

      const embedding = response.data.embedding;

      if (!Array.isArray(embedding)) {
        throw new Error('Invalid response from Ollama API: embedding is not an array');
      }

      if (embedding.length !== this.dimensions) {
        logger.warn(
          `Embedding dimension mismatch. Expected ${this.dimensions}, got ${embedding.length}`
        );
      }

      logger.debug('Successfully generated Ollama embedding', {
        dimensions: embedding.length,
      });

      return embedding;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        if (error.code === 'ECONNREFUSED') {
          throw new Error(`Cannot connect to Ollama at ${this.host}. Make sure Ollama is running.`);
        }
        if (error.response?.status === 404) {
          throw new Error(
            `Model "${this.model}" not found. Make sure to pull it with: ollama pull ${this.model}`
          );
        }
        throw new Error(`Ollama API error: ${error.message}`);
      }
      throw error;
    }
  }

  /**
   * Generate embeddings for multiple texts
   *
   * @param texts - Array of texts to generate embeddings for
   * @returns Promise resolving to array of embedding vectors
   */
  override async generateEmbeddings(texts: string[]): Promise<number[][]> {
    logger.debug(`Generating ${texts.length} Ollama embeddings`);

    // Ollama doesn't support batch embeddings, so we need to process sequentially
    // to avoid overwhelming the local server
    const embeddings: number[][] = [];

    for (let i = 0; i < texts.length; i++) {
      try {
        const embedding = await this.generateEmbedding(texts[i]);
        embeddings.push(embedding);

        // Log progress for large batches
        if (texts.length > 10 && (i + 1) % 10 === 0) {
          logger.debug(`Generated ${i + 1}/${texts.length} embeddings`);
        }
      } catch (error) {
        logger.error(`Failed to generate embedding for text ${i}`, error);
        throw error;
      }
    }

    logger.debug(`Successfully generated ${embeddings.length} Ollama embeddings`);
    return embeddings;
  }

  /**
   * Get information about the embedding model
   *
   * @returns Model information
   */
  override getModelInfo(): EmbeddingModelInfo {
    return {
      name: this.model,
      dimensions: this.dimensions,
      version: this.version,
    };
  }

  /**
   * Get information about the embedding provider
   *
   * @returns Provider information
   */
  override getProviderInfo(): EmbeddingProviderInfo {
    return {
      provider: 'ollama',
      model: this.model,
      dimensions: this.dimensions,
    };
  }
}
