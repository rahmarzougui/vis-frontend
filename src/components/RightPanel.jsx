const RightPanel = () => {
  return (
    <div className="w-80 bg-white border-l border-gray-200 p-6 overflow-y-auto">
      <div className="space-y-4">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          Warning Details
        </h2>
        
        {/* Warning Cards Container */}
        <div className="space-y-3">
          <h3 className="text-sm font-medium text-gray-700 mb-3">
            Warning Information
          </h3>
          
          {/* Warning Cards */}
          <div className="space-y-3 max-h-96 overflow-y-auto pr-2">
            {/* Sample Warning Card 1 */}
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center space-x-2">
                  <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                  <span className="text-sm font-medium text-red-800">High Severity</span>
                </div>
                <span className="text-xs text-red-600 bg-red-100 px-2 py-1 rounded">ESLint</span>
              </div>
              <h4 className="text-sm font-semibold text-gray-900 mb-1">
                Unused Variable
              </h4>
              <p className="text-xs text-gray-600 mb-2">
                Variable 'unusedVar' is assigned but never used
              </p>
              <div className="text-xs text-gray-500">
                📁 src/components/Example.jsx:15
              </div>
            </div>

            {/* Sample Warning Card 2 */}
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center space-x-2">
                  <div className="w-2 h-2 bg-yellow-500 rounded-full"></div>
                  <span className="text-sm font-medium text-yellow-800">Medium Severity</span>
                </div>
                <span className="text-xs text-yellow-600 bg-yellow-100 px-2 py-1 rounded">JavaScript</span>
              </div>
              <h4 className="text-sm font-semibold text-gray-900 mb-1">
                Variable Declaration
              </h4>
              <p className="text-xs text-gray-600 mb-2">
                Parameter 'data' could be better typed
              </p>
              <div className="text-xs text-gray-500">
                📁 src/utils/helper.js:8
              </div>
            </div>

            {/* Sample Warning Card 3 */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center space-x-2">
                  <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                  <span className="text-sm font-medium text-blue-800">Low Severity</span>
                </div>
                <span className="text-xs text-blue-600 bg-blue-100 px-2 py-1 rounded">Prettier</span>
              </div>
              <h4 className="text-sm font-semibold text-gray-900 mb-1">
                Code Formatting
              </h4>
              <p className="text-xs text-gray-600 mb-2">
                Missing semicolon at end of statement
              </p>
              <div className="text-xs text-gray-500">
                📁 src/components/Button.jsx:23
              </div>
            </div>

            {/* Empty state when no warnings */}
            <div className="text-center py-6 text-gray-400">
              <div className="text-2xl mb-2">✅</div>
              <p className="text-xs">No warnings found</p>
            </div>
          </div>
        </div>

        {/* Additional Info Placeholder */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h4 className="text-sm font-medium text-blue-900 mb-2">
            Node Information
          </h4>
          <div className="space-y-1 text-xs text-blue-700">
            <div>Function: <span className="text-gray-600">-</span></div>
            <div>Complexity: <span className="text-gray-600">-</span></div>
            <div>Call Count: <span className="text-gray-600">-</span></div>
            <div>Warnings: <span className="text-gray-600">-</span></div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RightPanel;
