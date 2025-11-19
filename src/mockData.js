import mockData from './mockData.json';

// Extract warnings and functions from JSON data
export const mockWarnings = mockData.warnings;
export const mockFunctions = mockData.functions.map(func => ({
  ...func,
  warnings: func.warnings.map(warningId => 
    mockWarnings.find(warning => warning.id === warningId)
  ).filter(Boolean)
}));

// Export nodes and edges for call graph
export const mockNodes = mockData.nodes;
export const mockEdges = mockData.edges;
export { mockData };
