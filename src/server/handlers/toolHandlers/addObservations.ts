/**
 * Handles the add_observations tool request
 * @param args The arguments for the tool request
 * @param knowledgeGraphManager The KnowledgeGraphManager instance
 * @returns A response object with the result content
 */
export async function handleAddObservations(args: any, knowledgeGraphManager: any) {
  const result = await knowledgeGraphManager.addObservations(args.observations);
  return { 
    content: [{ 
      type: 'text', 
      text: JSON.stringify(result, null, 2) 
    }] 
  };
} 