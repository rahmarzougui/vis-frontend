import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { mockWarnings, mockFunctions } from '../mockData';

const WarningsPage = () => {
  const navigate = useNavigate();
  const [selectedTool, setSelectedTool] = useState('');
  const [selectedSeverity, setSelectedSeverity] = useState('');
  const [appliedTool, setAppliedTool] = useState('');
  const [appliedSeverity, setAppliedSeverity] = useState('');
  const [hoveredWarning, setHoveredWarning] = useState(null);
  const [selectedWarnings, setSelectedWarnings] = useState([]);
  const [userTask, setUserTask] = useState('exploring');

  // Helper function to get function details for a warning
  const getFunctionDetails = (functionName) => {
    const func = mockFunctions.find(f => f.name === functionName);
    return {
      complexity: func?.complexity || 0,
      callCount: func?.callCount || 0,
      functionId: func?.id || 1 // Fallback to 1 if not found
    };
  };

  // Helper function to get function ID from function name
  const getFunctionId = (functionName) => {
    const func = mockFunctions.find(f => f.name === functionName);
    return func?.id || 1; // Fallback to 1 if not found
  };

  // 필터링 및 정렬된 경고 데이터
  const filteredAndSortedWarnings = useMemo(() => {
    let filtered = [...mockWarnings];

    // 적용된 Tool 필터만 사용
    if (appliedTool) {
      filtered = filtered.filter(warning => warning.tool === appliedTool);
    }

    // 적용된 Severity 필터만 사용
    if (appliedSeverity) {
      filtered = filtered.filter(warning => warning.severity === appliedSeverity);
    }

    // 필터가 적용된 경우에만 정렬
    if (appliedTool || appliedSeverity) {
      filtered.sort((a, b) => {
        // 1. 적용된 Tool이 있으면 해당 Tool을 우선
        if (appliedTool) {
          const aToolMatch = a.tool === appliedTool ? 1 : 0;
          const bToolMatch = b.tool === appliedTool ? 1 : 0;
          if (aToolMatch !== bToolMatch) {
            return bToolMatch - aToolMatch;
          }
        }

        // 2. 적용된 Severity가 있으면 해당 Severity를 우선
        if (appliedSeverity) {
          const aSeverityMatch = a.severity === appliedSeverity ? 1 : 0;
          const bSeverityMatch = b.severity === appliedSeverity ? 1 : 0;
          if (aSeverityMatch !== bSeverityMatch) {
            return bSeverityMatch - aSeverityMatch;
          }
        }

        // 3. Severity 우선순위 (High > Medium > Low)
        const severityOrder = { 'High': 3, 'Medium': 2, 'Low': 1 };
        const aSeverityOrder = severityOrder[a.severity] || 0;
        const bSeverityOrder = severityOrder[b.severity] || 0;
        
        if (aSeverityOrder !== bSeverityOrder) {
          return bSeverityOrder - aSeverityOrder;
        }

        // 4. Tool 알파벳 순
        return a.tool.localeCompare(b.tool);
      });
    }

    return filtered;
  }, [appliedTool, appliedSeverity]);

  // Apply Filters 함수
  const applyFilters = () => {
    setAppliedTool(selectedTool);
    setAppliedSeverity(selectedSeverity);
  };

  // Reset Filters 함수
  const resetFilters = () => {
    setSelectedTool('');
    setSelectedSeverity('');
    setAppliedTool('');
    setAppliedSeverity('');
    setSelectedWarnings([]);
  };

  const getSeverityColor = (severity) => {
    switch (severity) {
      case 'High':
        return 'bg-red-50 border-red-200 text-red-800 hover:border-red-300';
      case 'Medium':
        return 'bg-yellow-50 border-yellow-200 text-yellow-800 hover:border-yellow-300';
      case 'Low':
        return 'bg-blue-50 border-blue-200 text-blue-800 hover:border-blue-300';
      default:
        return 'bg-gray-50 border-gray-200 text-gray-800 hover:border-gray-300';
    }
  };

  const getSeverityDot = (severity) => {
    switch (severity) {
      case 'High':
        return 'bg-red-500';
      case 'Medium':
        return 'bg-yellow-500';
      case 'Low':
        return 'bg-blue-500';
      default:
        return 'bg-gray-500';
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-73px)]">
      {/* Task-based Navigation Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-6">
            <span className="text-sm font-medium text-gray-500">Current Task:</span>
            <div className="flex space-x-2">
              {['Exploring', 'Comparing', 'Debugging'].map(task => (
                <button
                  key={task}
                  className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
                    userTask.toLowerCase() === task.toLowerCase()
                      ? 'bg-primary text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                  onClick={() => setUserTask(task.toLowerCase())}
                >
                  {task}
                </button>
              ))}
            </div>
          </div>
          {userTask === 'comparing' && selectedWarnings.length > 0 && (
            <button 
              onClick={() => navigate(`/compare?ids=${selectedWarnings.join(',')}`)}
              className="bg-primary hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium"
            >
              Compare {selectedWarnings.length} Functions
            </button>
          )}
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Left Panel - Filters */}
        <div className="w-80 bg-white border-r border-gray-200 p-6 overflow-y-auto">
          <div className="space-y-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Analysis Controls</h2>
            
            {/* Task Guidance */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h3 className="text-sm font-medium text-blue-900 mb-2">Current Task</h3>
              <p className="text-xs text-blue-700">
                {userTask === 'exploring' && 'Explore warnings and understand code quality issues'}
                {userTask === 'comparing' && 'Compare functions to identify patterns and hotspots'}
                {userTask === 'debugging' && 'Focus on specific issues and their root causes'}
              </p>
            </div>

            {/* Tool Filter */}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">
                Analysis Tool
              </label>
              <select 
                value={selectedTool}
                onChange={(e) => setSelectedTool(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent transition-colors"
              >
                <option value="">All Tools</option>
                <option value="Infer">Infer</option>
                <option value="Clang">Clang</option>
                <option value="Lizard">Lizard</option>
                <option value="ESLint">ESLint</option>
                <option value="JavaScript">JavaScript</option>
                <option value="SonarQube">SonarQube</option>
                <option value="PMD">PMD</option>
                <option value="SpotBugs">SpotBugs</option>
                <option value="Checkstyle">Checkstyle</option>
                <option value="FindBugs">FindBugs</option>
                <option value="Clang Static Analyzer">Clang Static Analyzer</option>
              </select>
            </div>

            {/* Severity Filter */}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">
                Issue Severity
              </label>
              <select 
                value={selectedSeverity}
                onChange={(e) => setSelectedSeverity(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent transition-colors"
              >
                <option value="">All Severities</option>
                <option value="High">High - Critical Issues</option>
                <option value="Medium">Medium - Important Issues</option>
                <option value="Low">Low - Minor Issues</option>
              </select>
            </div>

            {/* Complexity Filter */}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">
                Complexity Level
              </label>
              <select className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent transition-colors">
                <option value="">Any Complexity</option>
                <option value="high">High (&gt;15)</option>
                <option value="medium">Medium (10-15)</option>
                <option value="low">Low (&lt;10)</option>
              </select>
            </div>

            {/* Apply Filters Button */}
            <button 
              onClick={applyFilters}
              className="w-full bg-primary hover:bg-blue-700 text-white py-2 px-4 rounded-lg font-medium transition-colors duration-200 shadow-sm hover:shadow-md"
            >
              Apply Filters
            </button>

            {/* Reset Filters Button */}
            <button 
              onClick={resetFilters}
              className="w-full bg-gray-200 hover:bg-gray-300 text-gray-700 py-2 px-4 rounded-lg font-medium transition-colors duration-200 shadow-sm hover:shadow-md"
            >
              Reset All Filters
            </button>

            {/* Selection Summary */}
            {selectedWarnings.length > 0 && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <h3 className="text-sm font-medium text-green-900 mb-2">
                  Selection Ready
                </h3>
                <p className="text-xs text-green-700">
                  {selectedWarnings.length} function{selectedWarnings.length > 1 ? 's' : ''} selected for comparison
                </p>
                <button
                  onClick={() => setSelectedWarnings([])}
                  className="w-full mt-2 bg-green-200 hover:bg-green-300 text-green-800 py-1 px-3 rounded text-sm"
                >
                  Clear Selection
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Center Panel - Warnings List */}
        <div className="flex-1 bg-white p-6 overflow-y-auto">
          <div className="max-w-6xl mx-auto">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Code Quality Analysis</h1>
                <p className="text-gray-600 mt-1">
                  {userTask === 'exploring' && 'Explore and understand code quality issues across your codebase'}
                  {userTask === 'comparing' && 'Compare functions to identify patterns and improvement opportunities'}
                  {userTask === 'debugging' && 'Focus on specific issues and trace their impact through call graphs'}
                </p>
              </div>
              <div className="text-right">
                <div className="text-sm text-gray-500">
                  {filteredAndSortedWarnings.length} warnings found
                  {(appliedTool || appliedSeverity) && (
                    <span className="ml-2 text-primary">(filtered)</span>
                  )}
                </div>
                <div className="text-xs text-gray-400 mt-1">
                  Click on warnings to analyze functions
                </div>
              </div>
            </div>

            <div className="space-y-4">
              {filteredAndSortedWarnings.map((warning) => {
                const functionDetails = getFunctionDetails(warning.function);
                const functionId = getFunctionId(warning.function);
                
                return (
                  <div
                    key={warning.id}
                    className={`border rounded-lg p-4 hover:shadow-lg transition-all cursor-pointer transform hover:scale-[1.002] ${
                      getSeverityColor(warning.severity)
                    } ${selectedWarnings.includes(warning.id) ? 'ring-2 ring-primary ring-opacity-50' : ''}`}
                    onClick={() => navigate(`/function/${functionId}`)}
                    onMouseEnter={() => setHoveredWarning(warning.id)}
                    onMouseLeave={() => setHoveredWarning(null)}
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-start space-x-3 flex-1">
                        <div className={`w-3 h-3 rounded-full mt-1.5 ${getSeverityDot(warning.severity)}`}></div>
                        <div className="flex-1">
                          <h3 className="font-semibold text-gray-900 text-lg mb-1">{warning.type}</h3>
                          <p className="text-sm text-gray-600 mb-2 line-clamp-2">{warning.description}</p>
                          
                          {/* Visual Hover Card */}
                          {hoveredWarning === warning.id && (
                            <div className="bg-white rounded-lg border border-gray-300 p-4 shadow-lg mt-3">
                              <div className="flex items-start justify-between mb-3">
                                <div>
                                  <h4 className="font-semibold text-gray-900 text-sm">{warning.type}</h4>
                                  <p className="text-xs text-gray-600">{warning.description}</p>
                                </div>
                                <span className="bg-red-100 text-red-800 text-xs px-2 py-1 rounded">High Risk</span>
                              </div>

                              {/* Visual Metrics */}
                              <div className="space-y-3">
                                {/* Complexity Gauge */}
                                <div>
                                  <div className="flex justify-between text-xs mb-1">
                                    <span className="font-medium">Complexity</span>
                                    <span className="text-red-600">{functionDetails.complexity}/10</span>
                                  </div>
                                  <div className="flex space-x-1">
                                    {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((level) => (
                                      <div 
                                        key={level}
                                        className={`flex-1 h-2 rounded ${
                                          level <= functionDetails.complexity ? 'bg-red-500' : 'bg-gray-200'
                                        }`}
                                      ></div>
                                    ))}
                                  </div>
                                </div>

                                {/* Call Count Trend */}
                                <div>
                                  <div className="flex justify-between text-xs mb-1">
                                    <span className="font-medium">Call Activity</span>
                                    <span>{functionDetails.callCount} calls</span>
                                  </div>
                                  <div className="flex items-end justify-between h-6 space-x-1">
                                    {[3, 7, 5, 9, 12, functionDetails.callCount, 11].map((value, idx) => (
                                      <div 
                                        key={idx}
                                        className="flex-1 bg-blue-400 rounded-t transition-all hover:bg-blue-500"
                                        style={{ height: `${Math.min(100, (value / 20) * 100)}%` }}
                                      ></div>
                                    ))}
                                  </div>
                                </div>

                                {/* Impact Visualization */}
                                <div className="flex items-center justify-between">
                                  <span className="text-xs font-medium">Impact Level</span>
                                  <div className="flex space-x-1">
                                    {[1, 2, 3, 4, 5].map((level) => (
                                      <div 
                                        key={level}
                                        className={`w-3 h-3 rounded-full ${
                                          level <= 3 ? 'bg-red-500' : 'bg-gray-300'
                                        }`}
                                      ></div>
                                    ))}
                                  </div>
                                </div>
                              </div>

                              {/* Quick Actions */}
                              <div className="flex space-x-2 mt-3 pt-2 border-t border-gray-200">
                                <button 
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setSelectedWarnings(prev => 
                                      prev.includes(warning.id) 
                                        ? prev.filter(id => id !== warning.id)
                                        : [...prev, warning.id]
                                    );
                                  }}
                                  className="flex-1 bg-blue-500 hover:bg-blue-600 text-white text-xs py-1.5 rounded transition-colors"
                                >
                                  {selectedWarnings.includes(warning.id) ? 'Selected' : 'Compare'}
                                </button>
                                <button 
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    navigate(`/function/${functionId}`);
                                  }}
                                  className="flex-1 bg-gray-500 hover:bg-gray-600 text-white text-xs py-1.5 rounded transition-colors"
                                >
                                  Analyze
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                      
                      <div className="flex flex-col items-end space-y-2">
                        <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded">
                          {warning.tool}
                        </span>
                        <span className={`text-xs font-medium px-2 py-1 rounded ${
                          warning.severity === 'High' ? 'bg-red-100 text-red-800' :
                          warning.severity === 'Medium' ? 'bg-yellow-100 text-yellow-800' :
                          'bg-blue-100 text-blue-800'
                        }`}>
                          {warning.severity}
                        </span>
                      </div>
                    </div>
                    
                    <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-200">
                      <div className="text-sm text-gray-500 flex items-center space-x-4">
                        <span className="flex items-center">
                          <span className="font-medium">Function:</span> 
                          <span className="ml-1 text-gray-700">{warning.function}</span>
                        </span>
                        <span className="flex items-center">
                          <span className="font-medium">File:</span>
                          <span className="ml-1 text-gray-700">{warning.file}:{warning.line}</span>
                        </span>
                      </div>
                      
                      <div className="flex space-x-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedWarnings(prev => 
                              prev.includes(warning.id) 
                                ? prev.filter(id => id !== warning.id)
                                : [...prev, warning.id]
                            );
                          }}
                          className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                            selectedWarnings.includes(warning.id)
                              ? 'bg-primary text-white'
                              : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                          }`}
                        >
                          {selectedWarnings.includes(warning.id) ? 'Selected' : 'Compare'}
                        </button>
                        
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/function/${functionId}`);
                          }}
                          className="bg-primary hover:bg-blue-700 text-white px-4 py-1.5 rounded text-sm font-medium transition-colors"
                        >
                          Analyze
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right Panel - Summary */}
        <div className="w-80 bg-white border-l border-gray-200 p-6 overflow-y-auto">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Analysis Summary</h2>
          
          <div className="space-y-4">
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <div className="flex items-center space-x-2 mb-2">
                <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                <span className="text-sm font-medium text-red-800">High Severity Issues</span>
              </div>
              <div className="text-2xl font-bold text-red-900">
                {filteredAndSortedWarnings.filter(w => w.severity === 'High').length}
              </div>
              <p className="text-xs text-red-700 mt-1">
                Critical issues requiring immediate attention
              </p>
            </div>

            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <div className="flex items-center space-x-2 mb-2">
                <div className="w-2 h-2 bg-yellow-500 rounded-full"></div>
                <span className="text-sm font-medium text-yellow-800">Medium Severity Issues</span>
              </div>
              <div className="text-2xl font-bold text-yellow-900">
                {filteredAndSortedWarnings.filter(w => w.severity === 'Medium').length}
              </div>
              <p className="text-xs text-yellow-700 mt-1">
                Important issues to address soon
              </p>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-center space-x-2 mb-2">
                <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                <span className="text-sm font-medium text-blue-800">Low Severity Issues</span>
              </div>
              <div className="text-2xl font-bold text-blue-900">
                {filteredAndSortedWarnings.filter(w => w.severity === 'Low').length}
              </div>
              <p className="text-xs text-blue-700 mt-1">
                Minor issues for future consideration
              </p>
            </div>

            {/* Tools Summary */}
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
              <h3 className="text-sm font-medium text-gray-900 mb-3">Tools Analysis</h3>
              <div className="space-y-2">
                {Array.from(new Set(filteredAndSortedWarnings.map(w => w.tool))).map(tool => (
                  <div key={tool} className="flex justify-between items-center text-xs">
                    <span className="text-gray-600">{tool}</span>
                    <span className="font-medium bg-gray-200 px-2 py-1 rounded">
                      {filteredAndSortedWarnings.filter(w => w.tool === tool).length}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default WarningsPage;
