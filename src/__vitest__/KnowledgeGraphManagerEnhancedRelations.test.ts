/**
 * Test file for KnowledgeGraphManager with enhanced relations
 */
import { describe, it, expect, vi } from 'vitest';
import { KnowledgeGraphManager, Relation } from '../KnowledgeGraphManager.js';
import { StorageProvider } from '../storage/StorageProvider.js';
import type { RelationMetadata } from '../types/relation.js';

describe('KnowledgeGraphManager with Enhanced Relations', () => {
  it('should use StorageProvider getRelation for retrieving a relation', async () => {
    const timestamp = Date.now();
    const enhancedRelation: Relation = {
      from: 'entity1',
      to: 'entity2',
      relationType: 'knows',
      strength: 0.8,
      confidence: 0.9,
      metadata: {
        createdAt: timestamp,
        updatedAt: timestamp,
        inferredFrom: [], // Correct property according to RelationMetadata
        lastAccessed: timestamp
      }
    };
    
    const mockProvider: Partial<StorageProvider> = {
      loadGraph: vi.fn(),
      saveGraph: vi.fn(),
      searchNodes: vi.fn(),
      openNodes: vi.fn(),
      createRelations: vi.fn(),
      addObservations: vi.fn(),
      getRelation: vi.fn().mockResolvedValue(enhancedRelation)
    };
    
    const manager = new KnowledgeGraphManager({ storageProvider: mockProvider as StorageProvider });
    
    // Call getRelation method
    const relation = await manager.getRelation('entity1', 'entity2', 'knows');
    
    // Verify the provider's getRelation was called with the right parameters
    expect(mockProvider.getRelation).toHaveBeenCalledWith('entity1', 'entity2', 'knows');
    
    // Verify we got the expected relation back
    expect(relation).toEqual(enhancedRelation);
  });
  
  it('should use StorageProvider updateRelation for updating a relation', async () => {
    const timestamp = Date.now();
    const updatedRelation: Relation = {
      from: 'entity1',
      to: 'entity2',
      relationType: 'knows',
      strength: 0.9, // Updated strength
      confidence: 0.95, // Updated confidence
      metadata: {
        createdAt: timestamp,
        updatedAt: timestamp + 1000, // Updated timestamp
        inferredFrom: [],
        lastAccessed: timestamp
      }
    };
    
    const mockProvider: Partial<StorageProvider> = {
      loadGraph: vi.fn(),
      saveGraph: vi.fn(),
      searchNodes: vi.fn(),
      openNodes: vi.fn(),
      createRelations: vi.fn(),
      addObservations: vi.fn(),
      updateRelation: vi.fn().mockResolvedValue(undefined)
    };
    
    const manager = new KnowledgeGraphManager({ storageProvider: mockProvider as StorageProvider });
    
    // Call updateRelation method
    await manager.updateRelation(updatedRelation);
    
    // Verify the provider's updateRelation was called with the right parameters
    expect(mockProvider.updateRelation).toHaveBeenCalledWith(updatedRelation);
  });
  
  it('should implement a fallback for getRelation when no provider is available', async () => {
    // This will test the file-based fallback implementation
    // First, create a test instance with a mocked fs module
    const timestamp = Date.now();
    const mockFs = {
      readFile: vi.fn().mockResolvedValue(JSON.stringify({
        type: "relation",
        from: "entity1",
        to: "entity2",
        relationType: "knows",
        strength: 0.8,
        confidence: 0.9,
        metadata: {
          createdAt: timestamp,
          updatedAt: timestamp,
          inferredFrom: [],
          lastAccessed: timestamp
        }
      })),
      writeFile: vi.fn().mockResolvedValue(undefined),
      // Add minimum required fs methods to satisfy type checker
      access: vi.fn(),
      copyFile: vi.fn(),
      open: vi.fn(),
      rename: vi.fn()
    };
    
    const manager = new KnowledgeGraphManager();
    // Use type assertion to access protected member
    (manager as any).fsModule = mockFs;
    
    // Call getRelation method
    const relation = await manager.getRelation('entity1', 'entity2', 'knows');
    
    // Verify that fs.readFile was called
    expect(mockFs.readFile).toHaveBeenCalled();
    
    // Verify we got the expected relation
    expect(relation).toEqual(expect.objectContaining({
      from: "entity1",
      to: "entity2",
      relationType: "knows",
      strength: 0.8,
      confidence: 0.9
    }));
  });
  
  it('should implement a fallback for updateRelation when no provider is available', async () => {
    // This will test the file-based fallback implementation
    // Create a test instance with a mocked fs module that returns a simple graph
    const graphData = 
      `{"type":"entity","name":"entity1","entityType":"test","observations":[]}
      {"type":"entity","name":"entity2","entityType":"test","observations":[]}
      {"type":"relation","from":"entity1","to":"entity2","relationType":"knows","strength":0.5}`;
    
    const mockFs = {
      readFile: vi.fn().mockResolvedValue(graphData),
      writeFile: vi.fn().mockResolvedValue(undefined),
      // Add minimum required fs methods to satisfy type checker
      access: vi.fn(),
      copyFile: vi.fn(),
      open: vi.fn(),
      rename: vi.fn()
    };
    
    const manager = new KnowledgeGraphManager();
    // Use type assertion to access protected member
    (manager as any).fsModule = mockFs;
    
    const updatedRelation: Relation = {
      from: 'entity1',
      to: 'entity2',
      relationType: 'knows',
      strength: 0.9
    };
    
    // Call updateRelation method
    await manager.updateRelation(updatedRelation);
    
    // Verify that fs.readFile and fs.writeFile were called
    expect(mockFs.readFile).toHaveBeenCalled();
    expect(mockFs.writeFile).toHaveBeenCalled();
    
    // Check the write call argument contains the updated relation
    const writeCall = mockFs.writeFile.mock.calls[0];
    const fileContents = writeCall[1]; // Second argument to writeFile
    
    // Verify the file contains the updated strength value
    expect(fileContents).toContain('"strength":0.9');
  });
}); 