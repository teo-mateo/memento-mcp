import type { EmbeddingService } from './EmbeddingService.js';
import { DefaultEmbeddingService } from './DefaultEmbeddingService.js';
import { OpenAIEmbeddingService } from './OpenAIEmbeddingService.js';
import { AzureEmbeddingService } from './AzureEmbeddingService.js';
import { OllamaEmbeddingService } from './OllamaEmbeddingService.js';
import { logger } from '../utils/logger.js';

/**
 * Configuration options for embedding services
 */
export interface EmbeddingServiceConfig {
  provider?: string;
  model?: string;
  dimensions?: number;
  apiKey?: string;
  endpoint?: string;
  apiVersion?: string;
  host?: string;
  version?: string;
  [key: string]: unknown;
}

/**
 * Type definition for embedding service provider creation function
 */
type EmbeddingServiceProvider = (config?: EmbeddingServiceConfig) => EmbeddingService;

/**
 * Factory for creating embedding services
 */
export class EmbeddingServiceFactory {
  /**
   * Registry of embedding service providers
   */
  private static providers: Record<string, EmbeddingServiceProvider> = {};

  /**
   * Register a new embedding service provider
   *
   * @param name - Provider name
   * @param provider - Provider factory function
   */
  static registerProvider(name: string, provider: EmbeddingServiceProvider): void {
    EmbeddingServiceFactory.providers[name.toLowerCase()] = provider;
  }

  /**
   * Reset the provider registry - used primarily for testing
   */
  static resetRegistry(): void {
    EmbeddingServiceFactory.providers = {};
  }

  /**
   * Get a list of available provider names
   *
   * @returns Array of provider names
   */
  static getAvailableProviders(): string[] {
    return Object.keys(EmbeddingServiceFactory.providers);
  }

  /**
   * Create a service using a registered provider
   *
   * @param config - Configuration options including provider name and service-specific settings
   * @returns The created embedding service
   * @throws Error if the provider is not registered
   */
  static createService(config: EmbeddingServiceConfig = {}): EmbeddingService {
    const providerName = (config.provider || 'default').toLowerCase();
    logger.debug(`EmbeddingServiceFactory: Creating service with provider "${providerName}"`);

    const providerFn = EmbeddingServiceFactory.providers[providerName];

    if (providerFn) {
      try {
        const service = providerFn(config);
        logger.debug(
          `EmbeddingServiceFactory: Service created successfully with provider "${providerName}"`,
          {
            modelInfo: service.getModelInfo(),
          }
        );
        return service;
      } catch (error) {
        logger.error(
          `EmbeddingServiceFactory: Failed to create service with provider "${providerName}"`,
          error
        );
        throw error;
      }
    }

    // If provider not found, throw an error
    logger.error(`EmbeddingServiceFactory: Provider "${providerName}" is not registered`);
    throw new Error(`Provider "${providerName}" is not registered`);
  }

  /**
   * Create an embedding service from environment variables
   *
   * @returns An embedding service implementation
   */
  static createFromEnvironment(): EmbeddingService {
    // Check if we should use mock embeddings (for testing)
    const useMockEmbeddings = process.env.MOCK_EMBEDDINGS === 'true';
    const embeddingProvider = process.env.EMBEDDING_PROVIDER?.toLowerCase();

    logger.debug('EmbeddingServiceFactory: Creating service from environment variables', {
      mockEmbeddings: useMockEmbeddings,
      embeddingProvider: embeddingProvider || 'auto',
      azureKeyPresent: !!process.env.AZURE_OPENAI_API_KEY,
      azureEndpointPresent: !!process.env.AZURE_OPENAI_ENDPOINT,
      openaiKeyPresent: !!process.env.OPENAI_API_KEY,
      embeddingModel: process.env.OPENAI_EMBEDDING_MODEL || process.env.OLLAMA_MODEL || 'default',
    });

    if (useMockEmbeddings) {
      logger.info('EmbeddingServiceFactory: Using mock embeddings for testing');
      return new DefaultEmbeddingService();
    }

    // Check if a specific provider is requested
    if (embeddingProvider === 'ollama') {
      try {
        logger.debug('EmbeddingServiceFactory: Creating Ollama embedding service');
        const service = new OllamaEmbeddingService();
        logger.info('EmbeddingServiceFactory: Ollama embedding service created successfully', {
          model: service.getModelInfo().name,
          dimensions: service.getModelInfo().dimensions,
        });
        return service;
      } catch (error) {
        logger.error('EmbeddingServiceFactory: Failed to create Ollama service', error);
        logger.info('EmbeddingServiceFactory: Falling back to default embedding service');
        return new DefaultEmbeddingService();
      }
    }

    if (embeddingProvider === 'openai') {
      const openaiApiKey = process.env.OPENAI_API_KEY;
      if (!openaiApiKey) {
        logger.error(
          'EmbeddingServiceFactory: EMBEDDING_PROVIDER is set to "openai" but OPENAI_API_KEY is missing'
        );
        logger.info('EmbeddingServiceFactory: Falling back to default embedding service');
        return new DefaultEmbeddingService();
      }
    }

    if (embeddingProvider === 'azure') {
      const azureApiKey = process.env.AZURE_OPENAI_API_KEY;
      const azureEndpoint = process.env.AZURE_OPENAI_ENDPOINT;
      const azureModel = process.env.AZURE_OPENAI_MODEL;
      if (!azureApiKey || !azureEndpoint || !azureModel) {
        logger.error(
          'EmbeddingServiceFactory: EMBEDDING_PROVIDER is set to "azure" but Azure configuration is incomplete'
        );
        logger.info('EmbeddingServiceFactory: Falling back to default embedding service');
        return new DefaultEmbeddingService();
      }
    }

    // Auto-detect provider based on available configuration
    // Check for Azure OpenAI configuration first
    const azureApiKey = process.env.AZURE_OPENAI_API_KEY;
    const azureEndpoint = process.env.AZURE_OPENAI_ENDPOINT;
    const azureModel = process.env.AZURE_OPENAI_MODEL;
    const azureApiVersion = process.env.AZURE_OPENAI_API_VERSION;

    if (azureApiKey && azureEndpoint && azureModel) {
      try {
        logger.debug('EmbeddingServiceFactory: Creating Azure OpenAI embedding service', {
          endpoint: azureEndpoint,
          model: azureModel,
          apiVersion: azureApiVersion,
        });
        const service = new AzureEmbeddingService({
          apiKey: azureApiKey,
          endpoint: azureEndpoint,
          model: azureModel,
          apiVersion: azureApiVersion,
        });
        logger.info('EmbeddingServiceFactory: Azure OpenAI embedding service created successfully', {
          model: service.getModelInfo().name,
          dimensions: service.getModelInfo().dimensions,
        });
        return service;
      } catch (error) {
        logger.error('EmbeddingServiceFactory: Failed to create Azure OpenAI service', error);
        logger.info('EmbeddingServiceFactory: Falling back to check other providers');
        // Continue to check other providers
      }
    }

    // Check for OpenAI configuration
    const openaiApiKey = process.env.OPENAI_API_KEY;
    const embeddingModel = process.env.OPENAI_EMBEDDING_MODEL || 'text-embedding-3-small';

    if (openaiApiKey) {
      try {
        logger.debug('EmbeddingServiceFactory: Creating OpenAI embedding service', {
          model: embeddingModel,
        });
        const service = new OpenAIEmbeddingService({
          apiKey: openaiApiKey,
          model: embeddingModel,
        });
        logger.info('EmbeddingServiceFactory: OpenAI embedding service created successfully', {
          model: service.getModelInfo().name,
          dimensions: service.getModelInfo().dimensions,
        });
        return service;
      } catch (error) {
        logger.error('EmbeddingServiceFactory: Failed to create OpenAI service', error);
        logger.info('EmbeddingServiceFactory: Falling back to default embedding service');
        // Fallback to default if OpenAI service creation fails
        return new DefaultEmbeddingService();
      }
    }

    // No API keys found, using default embedding service
    logger.info(
      'EmbeddingServiceFactory: No API keys found, using default embedding service'
    );
    return new DefaultEmbeddingService();
  }

  /**
   * Create an OpenAI embedding service
   *
   * @param apiKey - OpenAI API key
   * @param model - Optional model name
   * @param dimensions - Optional embedding dimensions
   * @returns OpenAI embedding service
   */
  static createOpenAIService(
    apiKey: string,
    model?: string,
    dimensions?: number
  ): EmbeddingService {
    return new OpenAIEmbeddingService({
      apiKey,
      model,
      dimensions,
    });
  }

  /**
   * Create an Azure OpenAI embedding service
   *
   * @param apiKey - Azure OpenAI API key
   * @param endpoint - Azure OpenAI endpoint
   * @param model - Azure OpenAI model/deployment name
   * @param apiVersion - Optional API version
   * @param dimensions - Optional embedding dimensions
   * @returns Azure OpenAI embedding service
   */
  static createAzureService(
    apiKey: string,
    endpoint: string,
    model: string,
    apiVersion?: string,
    dimensions?: number
  ): EmbeddingService {
    return new AzureEmbeddingService({
      apiKey,
      endpoint,
      model,
      apiVersion,
      dimensions,
    });
  }

  /**
   * Create a default embedding service that generates random vectors
   *
   * @param dimensions - Optional embedding dimensions
   * @returns Default embedding service
   */
  static createDefaultService(dimensions?: number): EmbeddingService {
    return new DefaultEmbeddingService(dimensions);
  }
}

// Register built-in providers
EmbeddingServiceFactory.registerProvider('default', (config = {}) => {
  return new DefaultEmbeddingService(config.dimensions);
});

EmbeddingServiceFactory.registerProvider('openai', (config = {}) => {
  if (!config.apiKey) {
    throw new Error('API key is required for OpenAI embedding service');
  }

  return new OpenAIEmbeddingService({
    apiKey: config.apiKey,
    model: config.model,
    dimensions: config.dimensions,
  });
});

EmbeddingServiceFactory.registerProvider('azure', (config = {}) => {
  if (!config.apiKey) {
    throw new Error('API key is required for Azure OpenAI embedding service');
  }

  if (!config.endpoint) {
    throw new Error('Endpoint is required for Azure OpenAI embedding service');
  }

  if (!config.model) {
    throw new Error('Model name is required for Azure OpenAI embedding service');
  }

  return new AzureEmbeddingService({
    apiKey: config.apiKey,
    endpoint: config.endpoint,
    model: config.model,
    apiVersion: config.apiVersion,
    dimensions: config.dimensions,
  });
});

EmbeddingServiceFactory.registerProvider('ollama', (config = {}) => {
  return new OllamaEmbeddingService({
    host: config.host as string | undefined,
    model: config.model as string | undefined,
    dimensions: config.dimensions as number | undefined,
  });
});