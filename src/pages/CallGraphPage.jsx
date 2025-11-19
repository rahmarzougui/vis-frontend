import { useParams, useNavigate } from 'react-router-dom';
import { mockFunctions } from '../mockData';
import { useState } from 'react';

const CallGraphPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [graphDepth, setGraphDepth] = useState('direct');
  const [selectedComplexity, setSelectedComplexity] = useState([]);
  
  const functionId = parseInt(id || '1');
  const func = mockFunctions.find(f => f.id === functionId);

  if (!func) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-73px)]">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Function not found</h2>
          <button
            onClick={() => navigate('/warnings')}
            className="bg-primary hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-colors duration-200"
          >
            Back to Warnings
          </button>
        </div>
      </div>
    );
  }

  const toggleComplexityFilter = (complexity) => {
    setSelectedComplexity(prev =>
      prev.includes(complexity)
        ? prev.filter(c => c !== complexity)
        : [...prev, complexity]
    );
  };

  return (
    <div className="h-[calc(100vh-73px)] flex flex-col">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-gray-900">Function Detail Graph</h1>
            <p className="text-sm text-gray-600">Exploring call relationships for: <strong>{func.name}</strong></p>
          </div>
          <div className="flex space-x-3">
            <button
              onClick={() => navigate(`/function/${func.id}`)}
              className="bg-gray-200 hover:bg-gray-300 text-gray-700 px-4 py-2 rounded-lg font-medium transition-colors duration-200"
            >
              Back to Function
            </button>
            <button
              onClick={() => navigate('/warnings')}
              className="bg-primary hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-colors duration-200"
            >
              Back to Warnings
            </button>
          </div>
        </div>
      </div>

      {/* Main Graph Area */}
      <div className="flex-1 flex bg-white">
        {/* Sidebar for graph controls */}
        <div className="w-80 bg-gray-50 border-r border-gray-200 p-6 overflow-y-auto">
          <div className="space-y-6">
            <h3 className="font-semibold text-gray-900 mb-4">Graph Controls</h3>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Analysis Depth
              </label>
              <div className="flex gap-4">
                {[
                  { value: 'direct', label: 'Direct', description: 'Immediate calls' },
                  { value: '2levels', label: '2 Levels', description: '2 levels deep' },
                  { value: 'full', label: 'Full Tree', description: 'Complete hierarchy' }
                ].map(option => (
                  <label key={option.value} className="flex items-start space-x-1.5 cursor-pointer flex-1">
                    <input 
                      type="radio" 
                      name="depth" 
                      value={option.value}
                      checked={graphDepth === option.value}
                      onChange={(e) => setGraphDepth(e.target.value)}
                      className="mt-0.5"
                    />
                    <div className="flex-1">
                      <div className="text-xs font-medium text-gray-700">{option.label}</div>
                      <div className="text-[10px] text-gray-500">{option.description}</div>
                    </div>
                  </label>
                ))}
              </div>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-3">
                Filter by Complexity
              </label>
              <div className="space-y-2">
                {[
                  { value: 'high', label: 'High (>15)', color: 'red' },
                  { value: 'medium', label: 'Medium (10-15)', color: 'yellow' },
                  { value: 'low', label: 'Low (<10)', color: 'green' }
                ].map(option => (
                  <label key={option.value} className="flex items-center space-x-3 cursor-pointer">
                    <input 
                      type="checkbox" 
                      checked={selectedComplexity.includes(option.value)}
                      onChange={() => toggleComplexityFilter(option.value)}
                      className="rounded border-gray-300"
                    />
                    <div className="flex items-center space-x-2">
                      <div className={`w-3 h-3 rounded-full bg-${option.color}-500`}></div>
                      <span className="text-sm text-gray-700">{option.label}</span>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h4 className="text-sm font-medium text-blue-900 mb-2">
                Analysis Tips
              </h4>
              <ul className="text-xs text-blue-700 space-y-1">
                <li>• Hover over nodes for details</li>
                <li>• Click nodes to navigate</li>
                <li>• Red borders indicate high complexity</li>
                <li>• Dashed lines show indirect calls</li>
              </ul>
            </div>

            <button className="w-full bg-primary hover:bg-blue-700 text-white py-2 px-4 rounded-lg font-medium transition-colors">
              Analyze Critical Path
            </button>

            <button className="w-full bg-green-600 hover:bg-green-700 text-white py-2 px-4 rounded-lg font-medium transition-colors">
              Export Graph
            </button>
          </div>
        </div>

        {/* Graph Visualization Area */}
        <div className="flex-1 p-6">
          <div className="bg-gradient-to-br from-blue-50 to-indigo-100 rounded-lg border-2 border-gray-200 h-full flex">
            {/* Mock graph visualization */}
            <div className="flex-1 p-6">
              <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-4 max-w-4xl mx-auto">
                <div className="text-center mb-4">
                  <h3 className="text-lg font-semibold text-gray-800 mb-1">
                    Call Graph: {func.name}
                  </h3>
                  <p className="text-sm text-gray-600">
                    Visualizing function call relationships and complexity
                  </p>
                </div>

                {/* Mock graph nodes */}
                <div className="flex flex-col items-center space-y-4">
                  {/* Level 1 */}
                  <div className="flex items-center justify-center space-x-8">
                    <div className="bg-white rounded-lg p-2 shadow-md border-2 border-green-400 text-center min-w-[100px]">
                      <div className="text-xs font-semibold text-gray-600">main()</div>
                      <div className="text-[10px] text-gray-500 mt-0.5">CC: 8</div>
                    </div>
                  </div>

                  {/* Arrow */}
                  <div className="text-2xl text-gray-400">↓</div>

                  {/* Level 2 - Current Function */}
                  <div className="flex items-center justify-center space-x-8">
                    <div className="bg-white rounded-lg p-2 shadow-lg border-2 border-yellow-400 text-center min-w-[120px] transform scale-105">
                      <div className="text-xs font-bold text-gray-800">{func.name}</div>
                      <div className="text-[10px] text-gray-600 mt-0.5">Current Focus</div>
                      <div className="text-[10px] text-gray-500 mt-0.5">CC: {func.complexity}</div>
                      <div className="text-[10px] text-red-500 font-medium mt-0.5">
                        {func.warnings.length} warning{func.warnings.length !== 1 ? 's' : ''}
                      </div>
                    </div>
                  </div>

                  {/* Arrow */}
                  <div className="text-2xl text-gray-400">↓</div>

                  {/* Level 3 - Called Functions */}
                  <div className="flex items-center justify-center space-x-6">
                    {[
                      { name: 'validateInput', complexity: 6, warnings: 0 },
                      { name: 'processData', complexity: 12, warnings: 2 },
                      { name: 'helperUtil', complexity: 4, warnings: 0 },
                    ].map((callee, index) => (
                      <div key={index} className="flex flex-col items-center">
                        <div className={`bg-white rounded-lg p-2 shadow-sm border-2 text-center min-w-[90px] ${
                          callee.complexity > 10 ? 'border-red-300' : 'border-blue-300'
                        }`}>
                          <div className="text-xs font-semibold text-gray-700">{callee.name}</div>
                          <div className="text-[10px] text-gray-500 mt-0.5">CC: {callee.complexity}</div>
                          {callee.warnings > 0 && (
                            <div className="text-[10px] text-red-500 font-medium mt-0.5">
                              {callee.warnings} warning{callee.warnings !== 1 ? 's' : ''}
                            </div>
                          )}
                        </div>
                        <button
                          onClick={() => navigate(`/function/${index + 2}`)}
                          className="mt-1.5 bg-primary hover:bg-blue-700 text-white px-2 py-0.5 rounded text-xs transition-colors"
                        >
                          Analyze
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Graph Legend */}
                <div className="mt-12 pt-6 border-t border-gray-200">
                  <h4 className="text-sm font-semibold text-gray-700 mb-3">Graph Legend</h4>
                  <div className="flex justify-center space-x-6 text-xs">
                    <div className="flex items-center space-x-2">
                      <div className="w-3 h-3 border-2 border-green-400 rounded"></div>
                      <span className="text-gray-600">Caller Functions</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <div className="w-3 h-3 border-2 border-yellow-400 rounded bg-yellow-50"></div>
                      <span className="text-gray-600">Current Function</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <div className="w-3 h-3 border-2 border-blue-300 rounded"></div>
                      <span className="text-gray-600">Callee Functions</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <div className="w-3 h-3 border-2 border-red-300 rounded"></div>
                      <span className="text-gray-600">High Complexity</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Right sidebar - Node details */}
            <div className="w-80 bg-white border-l border-gray-200 p-6 overflow-y-auto">
              <h3 className="font-semibold text-gray-900 mb-4">Selected Node</h3>
              
              <div className="bg-gray-50 rounded-lg p-4 mb-4">
                <h4 className="font-semibold text-gray-800 text-sm mb-2">{func.name}</h4>
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Complexity:</span>
                    <span className="font-medium">{func.complexity}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Call Count:</span>
                    <span className="font-medium">{func.callCount}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Warnings:</span>
                    <span className="font-medium text-red-600">{func.warnings.length}</span>
                  </div>
                </div>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h4 className="text-sm font-medium text-blue-900 mb-2">
                  Call Statistics
                </h4>
                <div className="space-y-2 text-xs text-blue-700">
                  <div className="flex justify-between">
                    <span>Direct Calls:</span>
                    <span className="font-medium">3</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Total Call Tree:</span>
                    <span className="font-medium">12 functions</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Max Depth:</span>
                    <span className="font-medium">4 levels</span>
                  </div>
                </div>
              </div>

              <div className="mt-6">
                <h4 className="text-sm font-semibold text-gray-900 mb-3">Quick Actions</h4>
                <div className="space-y-2">
                  <button className="w-full bg-primary hover:bg-blue-700 text-white py-2 px-3 rounded text-sm font-medium transition-colors">
                    Focus on Critical Path
                  </button>
                  <button className="w-full bg-gray-200 hover:bg-gray-300 text-gray-700 py-2 px-3 rounded text-sm font-medium transition-colors">
                    Isolate Subtree
                  </button>
                  <button className="w-full bg-green-600 hover:bg-green-700 text-white py-2 px-3 rounded text-sm font-medium transition-colors">
                    Compare with Similar
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CallGraphPage;
