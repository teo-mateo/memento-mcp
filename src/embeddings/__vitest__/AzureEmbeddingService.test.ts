import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AzureEmbeddingService } from '../AzureEmbeddingService.js';
import { EmbeddingServiceFactory } from '../EmbeddingServiceFactory.js';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';
import type { EmbeddingServiceConfig } from '../EmbeddingServiceFactory';

// Load environment variables from .env file
const envPath = path.resolve(process.cwd(), '.env');
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
  console.log('Loaded .env file for Azure API key');
}

// Check if we're in mock mode
const useMockEmbeddings = process.env.MOCK_EMBEDDINGS === 'true';
if (useMockEmbeddings) {
  console.log('MOCK_EMBEDDINGS=true - Azure OpenAI API tests will be skipped');
}

// Check for Azure API key availability
const hasAzureApiKey = process.env.AZURE_OPENAI_API_KEY !== undefined;
const hasAzureEndpoint = process.env.AZURE_OPENAI_ENDPOINT !== undefined;
const hasAzureModel = process.env.AZURE_OPENAI_MODEL !== undefined;
const hasAzureConfig = hasAzureApiKey && hasAzureEndpoint && hasAzureModel;

console.log(`Azure OpenAI API key ${hasAzureApiKey ? 'is' : 'is not'} available`);
console.log(`Azure OpenAI endpoint ${hasAzureEndpoint ? 'is' : 'is not'} available`);
console.log(`Azure OpenAI model ${hasAzureModel ? 'is' : 'is not'} available`);

// Only run real API tests if we have complete Azure config AND we're not in mock mode
const shouldRunTests = hasAzureConfig && !useMockEmbeddings;
// Use conditional test functions based on environment
const conditionalTest = shouldRunTests ? it : it.skip;

// Log the decision for clarity
console.log(`Azure OpenAI API tests ${shouldRunTests ? 'WILL' : 'will NOT'} run`);

// Set NODE_ENV to match actual runtime
process.env.NODE_ENV = undefined;

describe('AzureEmbeddingService', () => {
  beforeEach(() => {
    // Reset factory
    EmbeddingServiceFactory.resetRegistry();

    // Register the Azure provider for testing
    EmbeddingServiceFactory.registerProvider('azure', (config?: EmbeddingServiceConfig) => {
      return new AzureEmbeddingService({
        apiKey: config?.apiKey || process.env.AZURE_OPENAI_API_KEY!,
        endpoint: config?.endpoint || process.env.AZURE_OPENAI_ENDPOINT!,
        model: config?.model || process.env.AZURE_OPENAI_MODEL!,
        apiVersion: config?.apiVersion || process.env.AZURE_OPENAI_API_VERSION,
        dimensions: config?.dimensions,
      });
    });

    // Increase timeout for real API calls
    vi.setConfig({ testTimeout: 30000 });
  });

  it('should throw error when configuration is missing', () => {
    expect(() => {
      // @ts-expect-error - Testing missing config
      new AzureEmbeddingService();
    }).toThrow('Configuration is required for Azure OpenAI embedding service');
  });

  it('should throw error when API key is missing', () => {
    expect(() => {
      new AzureEmbeddingService({
        apiKey: '',
        endpoint: 'https://test.openai.azure.com',
        model: 'text-embedding-ada-002',
      });
    }).toThrow('API key is required for Azure OpenAI embedding service');
  });

  it('should throw error when endpoint is missing', () => {
    expect(() => {
      new AzureEmbeddingService({
        apiKey: 'test-key',
        endpoint: '',
        model: 'text-embedding-ada-002',
      });
    }).toThrow('Endpoint is required for Azure OpenAI embedding service');
  });

  it('should throw error when model is missing', () => {
    expect(() => {
      new AzureEmbeddingService({
        apiKey: 'test-key',
        endpoint: 'https://test.openai.azure.com',
        model: '',
      });
    }).toThrow('Model name is required for Azure OpenAI embedding service');
  });

  conditionalTest('should create service instance directly', () => {
    // Skip if no Azure config
    if (!hasAzureConfig) {
      console.log('Skipping test - no Azure OpenAI config available');
      return;
    }

    const service = new AzureEmbeddingService({
      apiKey: process.env.AZURE_OPENAI_API_KEY!,
      endpoint: process.env.AZURE_OPENAI_ENDPOINT!,
      model: 'text-embedding-ada-002',
      apiVersion: process.env.AZURE_OPENAI_API_VERSION,
    });

    expect(service).toBeInstanceOf(AzureEmbeddingService);
  });

  conditionalTest('should create service instance via factory', () => {
    // Skip if no Azure config
    if (!hasAzureConfig) {
      console.log('Skipping test - no Azure OpenAI config available');
      return;
    }

    const service = EmbeddingServiceFactory.createService({
      provider: 'azure',
      apiKey: process.env.AZURE_OPENAI_API_KEY!,
      endpoint: process.env.AZURE_OPENAI_ENDPOINT!,
      model: process.env.AZURE_OPENAI_MODEL!,
    });

    expect(service).toBeInstanceOf(AzureEmbeddingService);
  });

  conditionalTest('should return correct model info', () => {
    // Skip if no Azure config
    if (!hasAzureConfig) {
      console.log('Skipping test - no Azure OpenAI config available');
      return;
    }

    const service = new AzureEmbeddingService({
      apiKey: process.env.AZURE_OPENAI_API_KEY!,
      endpoint: process.env.AZURE_OPENAI_ENDPOINT!,
      model: 'text-embedding-ada-002',
    });

    const modelInfo = service.getModelInfo();
    expect(modelInfo.name).toBe('text-embedding-ada-002');
    expect(modelInfo.dimensions).toBe(1536);
    expect(modelInfo.version).toBeDefined();
  });

  conditionalTest('should return correct provider info', () => {
    // Skip if no Azure config
    if (!hasAzureConfig) {
      console.log('Skipping test - no Azure OpenAI config available');
      return;
    }

    const service = new AzureEmbeddingService({
      apiKey: process.env.AZURE_OPENAI_API_KEY!,
      endpoint: process.env.AZURE_OPENAI_ENDPOINT!,
      model: 'text-embedding-ada-002',
    });

    const providerInfo = service.getProviderInfo();
    expect(providerInfo.provider).toBe('azure');
    expect(providerInfo.model).toBe('text-embedding-ada-002');
    expect(providerInfo.dimensions).toBe(1536);
  });

  conditionalTest('should generate embedding for single text input', async () => {
    // Skip if no Azure config
    if (!hasAzureConfig) {
      console.log('Skipping test - no Azure OpenAI config available');
      return;
    }

    const service = new AzureEmbeddingService({
      apiKey: process.env.AZURE_OPENAI_API_KEY!,
      endpoint: process.env.AZURE_OPENAI_ENDPOINT!,
      model: 'text-embedding-ada-002',
    });

    const embedding = await service.generateEmbedding('Test text');

    // Verify embedding structure
    expect(Array.isArray(embedding)).toBe(true);
    expect(embedding.length).toBe(1536);

    // Check for normalization
    const magnitude = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
    expect(magnitude).toBeCloseTo(1.0, 5);
  });

  conditionalTest('should generate embeddings for multiple texts', async () => {
    // Skip if no Azure config
    if (!hasAzureConfig) {
      console.log('Skipping test - no Azure OpenAI config available');
      return;
    }

    const service = new AzureEmbeddingService({
      apiKey: process.env.AZURE_OPENAI_API_KEY!,
      endpoint: process.env.AZURE_OPENAI_ENDPOINT!,
      model: 'text-embedding-ada-002',
    });

    const texts = ['Text 1', 'Text 2', 'Text 3'];
    const embeddings = await service.generateEmbeddings(texts);

    // Verify array structure
    expect(Array.isArray(embeddings)).toBe(true);
    expect(embeddings.length).toBe(3);

    // Check each embedding
    embeddings.forEach((embedding) => {
      expect(Array.isArray(embedding)).toBe(true);
      expect(embedding.length).toBe(1536);

      // Check for normalization
      const magnitude = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
      expect(magnitude).toBeCloseTo(1.0, 5);
    });
  });

  conditionalTest('should handle API errors gracefully', async () => {
    // Skip if no Azure config
    if (!hasAzureConfig) {
      console.log('Skipping test - no Azure OpenAI config available');
      return;
    }

    const service = new AzureEmbeddingService({
      apiKey: 'invalid-key',
      endpoint: process.env.AZURE_OPENAI_ENDPOINT!,
      model: 'text-embedding-ada-002',
    });

    // Should throw an error for invalid API key
    await expect(service.generateEmbedding('Test text')).rejects.toThrow();
  });

  conditionalTest('should construct correct API endpoint', () => {
    // Skip if no Azure config
    if (!hasAzureConfig) {
      console.log('Skipping test - no Azure OpenAI config available');
      return;
    }

    const service = new AzureEmbeddingService({
      apiKey: process.env.AZURE_OPENAI_API_KEY!,
      endpoint: 'https://test.openai.azure.com',
      deployment: 'test-deployment',
      apiVersion: '2023-05-15',
      model: 'text-embedding-ada-002',
    });

    // Access private field for testing (using type assertion)
    const apiEndpoint = (service as any).apiEndpoint;
    expect(apiEndpoint).toBe('https://test.openai.azure.com/openai/deployments/text-embedding-ada-002/embeddings?api-version=2023-05-15');
  });

  conditionalTest('should handle endpoint with trailing slash', () => {
    // Skip if no Azure config
    if (!hasAzureConfig) {
      console.log('Skipping test - no Azure OpenAI config available');
      return;
    }

    const service = new AzureEmbeddingService({
      apiKey: process.env.AZURE_OPENAI_API_KEY!,
      endpoint: 'https://test.openai.azure.com/',
      deployment: 'test-deployment',
      apiVersion: '2023-05-15',
      model: 'text-embedding-ada-002',
    });

    // Access private field for testing (using type assertion)
    const apiEndpoint = (service as any).apiEndpoint;
    expect(apiEndpoint).toBe('https://test.openai.azure.com/openai/deployments/text-embedding-ada-002/embeddings?api-version=2023-05-15');
  });
});