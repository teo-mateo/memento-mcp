import axios from 'axios';
import { EmbeddingService, type EmbeddingModelInfo } from './EmbeddingService.js';
import { logger } from '../utils/logger.js';

/**
 * Configuration for Azure OpenAI embedding service
 */
export interface AzureEmbeddingConfig {
  /**
   * Azure OpenAI API key
   */
  apiKey: string;

  /**
   * Azure OpenAI endpoint (e.g., https://your-resource.openai.azure.com)
   */
  endpoint: string;

  /**
   * Azure OpenAI model/deployment name
   */
  model: string;

  /**
   * Azure OpenAI API version (e.g., 2023-05-15)
   */
  apiVersion?: string;

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
 * Azure OpenAI API response structure
 */
interface AzureEmbeddingResponse {
  data: Array<{
    embedding: number[];
    index: number;
    object: string;
  }>;
  model: string;
  object: string;
  usage: {
    prompt_tokens: number;
    total_tokens: number;
  };
}

/**
 * Service implementation that generates embeddings using Azure OpenAI's API
 */
export class AzureEmbeddingService extends EmbeddingService {
  private apiKey: string;
  private endpoint: string;
  private apiVersion: string;
  private model: string;
  private dimensions: number;
  private version: string;
  private apiEndpoint: string;

  /**
   * Create a new Azure OpenAI embedding service
   *
   * @param config - Configuration for the service
   */
  constructor(config: AzureEmbeddingConfig) {
    super();

    if (!config) {
      throw new Error('Configuration is required for Azure OpenAI embedding service');
    }

    // Validate required fields
    if (!config.apiKey) {
      throw new Error('API key is required for Azure OpenAI embedding service');
    }

    if (!config.endpoint) {
      throw new Error('Endpoint is required for Azure OpenAI embedding service');
    }

    if (!config.model) {
      throw new Error('Model name is required for Azure OpenAI embedding service');
    }

    this.apiKey = config.apiKey;
    this.endpoint = config.endpoint.replace(/\/$/, ''); // Remove trailing slash
    this.apiVersion = config.apiVersion || '2023-05-15';
    this.model = config.model;
    this.dimensions = config.dimensions || 1536;
    this.version = config.version || '1.0.0';

    // Construct the full API endpoint
    this.apiEndpoint = `${this.endpoint}/openai/deployments/${this.model}/embeddings?api-version=${this.apiVersion}`;
  }

  /**
   * Generate an embedding for a single text
   *
   * @param text - Text to generate embedding for
   * @returns Promise resolving to embedding vector
   */
  override async generateEmbedding(text: string): Promise<number[]> {
    logger.debug('Generating embedding with Azure OpenAI', {
      text: text.substring(0, 50) + '...',
      model: this.model,
      apiVersion: this.apiVersion,
      endpoint: this.endpoint,
    });

    try {
      const response = await axios.post<AzureEmbeddingResponse>(
        this.apiEndpoint,
        {
          input: text,
        },
        {
          headers: {
            'api-key': this.apiKey,
            'Content-Type': 'application/json',
          },
          timeout: 30000, // 30 second timeout for Azure
        }
      );

      logger.debug('Received response from Azure OpenAI API');

      if (!response.data || !response.data.data || !response.data.data[0]) {
        logger.error('Invalid response from Azure OpenAI API', { response: response.data });
        throw new Error('Invalid response from Azure OpenAI API - missing embedding data');
      }

      const embedding = response.data.data[0].embedding;

      if (!embedding || !Array.isArray(embedding) || embedding.length === 0) {
        logger.error('Invalid embedding returned', { embedding });
        throw new Error('Invalid embedding returned from Azure OpenAI API');
      }

      logger.debug('Generated embedding', {
        length: embedding.length,
        sample: embedding.slice(0, 5),
        isArray: Array.isArray(embedding),
      });

      // Log token usage if in debug mode
      if (process.env.DEBUG === 'true') {
        const tokens = response.data.usage?.prompt_tokens || 'unknown';
        logger.debug('Azure OpenAI embedding token usage', { tokens });
      }

      // Normalize the embedding vector
      this._normalizeVector(embedding);
      logger.debug('Normalized embedding', {
        length: embedding.length,
        sample: embedding.slice(0, 5),
      });

      return embedding;
    } catch (error: unknown) {
      // Handle axios errors specifically
      const axiosError = error as {
        isAxiosError?: boolean;
        response?: {
          status?: number;
          data?: unknown;
        };
        message?: string;
      };

      if (axiosError.isAxiosError) {
        const statusCode = axiosError.response?.status;
        const responseData = axiosError.response?.data;

        logger.error('Azure OpenAI API error', {
          status: statusCode,
          data: responseData,
          message: axiosError.message,
        });

        // Handle specific error types
        if (statusCode === 401) {
          throw new Error('Azure OpenAI API authentication failed - invalid API key');
        } else if (statusCode === 429) {
          throw new Error('Azure OpenAI API rate limit exceeded - try again later');
        } else if (statusCode && statusCode >= 500) {
          throw new Error(`Azure OpenAI API server error (${statusCode}) - try again later`);
        }

        // Include response data in error if available
        const errorDetails = responseData
          ? `: ${JSON.stringify(responseData).substring(0, 200)}`
          : '';

        throw new Error(`Azure OpenAI API error (${statusCode || 'unknown'})${errorDetails}`);
      }

      // Handle other errors
      const errorMessage = this._getErrorMessage(error);
      logger.error('Failed to generate embedding', { error: errorMessage });
      throw new Error(`Error generating embedding: ${errorMessage}`);
    }
  }

  /**
   * Generate embeddings for multiple texts
   *
   * @param texts - Array of texts to generate embeddings for
   * @returns Promise resolving to array of embedding vectors
   */
  override async generateEmbeddings(texts: string[]): Promise<number[][]> {
    try {
      const response = await axios.post<AzureEmbeddingResponse>(
        this.apiEndpoint,
        {
          input: texts,
        },
        {
          headers: {
            'api-key': this.apiKey,
            'Content-Type': 'application/json',
          },
          timeout: 30000, // 30 second timeout for Azure
        }
      );

      const embeddings = response.data.data.map((item) => item.embedding);

      // Normalize each embedding vector
      embeddings.forEach((embedding) => {
        this._normalizeVector(embedding);
      });

      return embeddings;
    } catch (error: unknown) {
      const errorMessage = this._getErrorMessage(error);
      throw new Error(`Failed to generate embeddings: ${errorMessage}`);
    }
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
  override getProviderInfo() {
    return {
      provider: 'azure',
      model: this.model,
      dimensions: this.dimensions,
    };
  }

  /**
   * Extract error message from error object
   *
   * @private
   * @param error - Error object
   * @returns Error message string
   */
  private _getErrorMessage(error: unknown): string {
    if (error instanceof Error) {
      return error.message;
    }
    return String(error);
  }

  /**
   * Normalize a vector to unit length (L2 norm)
   *
   * @private
   * @param vector - Vector to normalize in-place
   */
  private _normalizeVector(vector: number[]): void {
    // Calculate magnitude (Euclidean norm / L2 norm)
    let magnitude = 0;
    for (let i = 0; i < vector.length; i++) {
      magnitude += vector[i] * vector[i];
    }
    magnitude = Math.sqrt(magnitude);

    // Avoid division by zero
    if (magnitude > 0) {
      // Normalize each component
      for (let i = 0; i < vector.length; i++) {
        vector[i] /= magnitude;
      }
    } else {
      // If magnitude is 0, set first element to 1 for a valid unit vector
      vector[0] = 1;
    }
  }
}
