// Note: This file connects Claude's tool calls to the appropriate internal function
// Each tool function is separate and should have the same name signature as the tools Claude uses

import { KnowledgeGraphManager } from './KnowledgeGraphManager.js';

export async function handleToolCall(
  manager: KnowledgeGraphManager, 
  toolCall: { name: string, args: Record<string, any> }
) {
  
  if (!toolCall || !toolCall.name) {
    console.error
    return { error: 'Invalid tool call' };
  }
  
  console.log

  // Handle the various tool calls
  try {
    switch(toolCall.name) {
      // ... existing code ...
      
      case 'get_decayed_graph': {
        // Note: The getDecayedGraph method no longer takes options
        // The decay settings now must be configured at the StorageProvider level
        const result = await manager.getDecayedGraph();
        return result;
      }
      
      // ... existing code ...
    }
  } catch (error) {
    // ... existing code ...
  }
} 