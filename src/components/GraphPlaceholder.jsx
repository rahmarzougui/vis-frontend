const GraphPlaceholder = () => {
  return (
    <div className="flex-1 bg-gradient-to-br from-gray-50 to-gray-100 border border-gray-200 rounded-lg m-4 flex flex-col">
      {/* Header with info icon */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200">
        <h3 className="text-lg font-semibold text-gray-700">
          Call Graph Visualization
        </h3>
        <div className="relative group">
          <div className="w-6 h-6 bg-gray-300 hover:bg-gray-400 rounded-full flex items-center justify-center cursor-help transition-colors">
            <span className="text-gray-600 text-sm font-bold">i</span>
          </div>
          {/* Tooltip */}
          <div className="absolute right-0 top-8 bg-gray-800 text-white text-xs rounded-lg px-3 py-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap z-10">
            <div className="flex items-center space-x-1">
              <span>🔍</span>
              <span>Select a node to view details</span>
            </div>
            {/* Tooltip arrow */}
            <div className="absolute -top-1 right-3 w-2 h-2 bg-gray-800 transform rotate-45"></div>
          </div>
        </div>
      </div>
      
      {/* Main content area */}
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <div className="text-6xl mb-4">📊</div>
          <p className="text-gray-500 text-sm mb-2">
            (coming soon)
          </p>
          <div className="text-xs text-gray-400">
            Interactive call graph will be rendered here
          </div>
        </div>
      </div>
    </div>
  );
};

export default GraphPlaceholder;
