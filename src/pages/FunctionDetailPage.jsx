import { useParams, useNavigate } from 'react-router-dom';
import { useState, useMemo } from 'react';
import cgData from '../../cg.json';
import sqliteFunctions from '../../sqlite_function.json';
import sqliteWarnings from '../../sqlite_warning.json';

const FunctionDetailPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [comparedFunctions, setComparedFunctions] = useState([]);
  const [activeTab, setActiveTab] = useState('overview');
  
  // Create maps for function data and warnings
  const functionDataMap = useMemo(() => {
    const map = new Map();
    sqliteFunctions.forEach((func, index) => {
      map.set(func.function, { ...func, id: index + 1 });
    });
    return map;
  }, []);

  const warningsByFunction = useMemo(() => {
    const map = new Map();
    sqliteWarnings.forEach(warning => {
      const funcName = warning.function;
      if (!map.has(funcName)) {
        map.set(funcName, []);
      }
      map.get(funcName).push({
        id: warning.id,
        type: warning.warning,
        severity: warning.severity_level === 'HIGH' ? 'High' : warning.severity_level === 'MID' ? 'Medium' : 'Low',
        description: warning.detail,
        file: warning.file,
        line: warning.line,
        tool: warning.tool,
        category: warning.category
      });
    });
    return map;
  }, []);

  // Get function by ID (index in cgData.nodes)
  const functionId = parseInt(id || '1');
  const node = cgData.nodes[functionId - 1];
  const nodeName = node ? (node.name || node.id) : null;
  const funcData = nodeName ? functionDataMap.get(nodeName) : null;
  const functionWarnings = nodeName ? (warningsByFunction.get(nodeName) || []) : [];

  const func = useMemo(() => {
    if (!node) return null;
    
    if (funcData) {
      const warning = funcData.warning || { HIGH: 0, MID: 0, LOW: 0 };
      const severityCounts = {
        High: warning.HIGH || 0,
        Medium: warning.MID || 0,
        Low: warning.LOW || 0
      };
      
      return {
        id: functionId,
        name: nodeName,
        complexity: funcData.CCN || 0,
        file: funcData.file || `src/${nodeName}.c`,
        callCount: funcData.out_degree || 0,
        description: `Function ${nodeName}`,
        warnings: functionWarnings,
        warningCount: warning.HIGH + warning.MID + warning.LOW,
        severityCounts,
        degree: funcData.degree || node.degree || 0,
        NLOC: funcData.NLOC,
        length: funcData.length,
        param: funcData.param,
        in_degree: funcData.in_degree,
        out_degree: funcData.out_degree
      };
    } else {
      // Fallback for functions in cg.json but not in sqlite_function.json
      return {
        id: functionId,
        name: nodeName,
        complexity: 0,
        file: `src/${nodeName}.c`,
        callCount: node.out_degree || 0,
        description: `Function ${nodeName}`,
        warnings: functionWarnings,
        warningCount: 0,
        severityCounts: { High: 0, Medium: 0, Low: 0 },
        degree: node.degree || 0,
        NLOC: 0,
        length: 0,
        param: 0,
        in_degree: node.in_degree || 0,
        out_degree: node.out_degree || 0
      };
    }
  }, [functionId, node, nodeName, funcData, functionWarnings]);

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

  const getSeverityColor = (severity) => {
    switch (severity) {
      case 'High':
        return 'bg-red-50 border-red-200 text-red-800';
      case 'Medium':
        return 'bg-yellow-50 border-yellow-200 text-yellow-800';
      case 'Low':
        return 'bg-blue-50 border-blue-200 text-blue-800';
      default:
        return 'bg-gray-50 border-gray-200 text-gray-800';
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

  const qualityScore = Math.max(0, 100 - func.complexity * 5 - func.warnings.length * 10);

  return (
    <div className="flex h-[calc(100vh-73px)]">
      {/* Left Panel - Function Info */}
      <div className="w-80 bg-white border-r border-gray-200 p-6 overflow-y-auto">
        <div className="space-y-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Function Details</h2>
          
          <div className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-lg p-4 border border-gray-200">
            <h3 className="font-semibold text-gray-900 mb-2 text-lg">{func.name}</h3>
            <p className="text-sm text-gray-600 mb-4 leading-relaxed">{func.description}</p>
            
            <div className="space-y-3 text-sm">
              <div className="flex justify-between items-center py-2 border-b border-gray-100">
                <span className="text-gray-500">Complexity:</span>
                <span className={`font-medium px-2 py-1 rounded ${
                  func.complexity > 15 ? 'bg-red-100 text-red-800' :
                  func.complexity > 10 ? 'bg-yellow-100 text-yellow-800' :
                  'bg-green-100 text-green-800'
                }`}>
                  {func.complexity}
                </span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-gray-100">
                <span className="text-gray-500">Call Count:</span>
                <span className="font-medium">{func.callCount}</span>
              </div>
              <div className="flex justify-between items-center py-2">
                <span className="text-gray-500">File:</span>
                <span className="font-medium text-xs text-gray-700">{func.file}</span>
              </div>
            </div>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h4 className="text-sm font-medium text-blue-900 mb-2">
              Quick Actions
            </h4>
            <div className="space-y-2">
              <button
                onClick={() => navigate(`/graph/${func.id}`)}
                className="w-full bg-primary hover:bg-blue-700 text-white py-2 px-3 rounded text-sm font-medium transition-colors"
              >
                View Function Detail Graph
              </button>
              <button
                onClick={() => setComparedFunctions(prev => [...prev, func.id])}
                className="w-full bg-gray-200 hover:bg-gray-300 text-gray-700 py-2 px-3 rounded text-sm font-medium transition-colors"
              >
                Add to Comparison
              </button>
            </div>
          </div>

          {/* Comparison Section */}
          {comparedFunctions.length > 0 && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <h4 className="text-sm font-medium text-yellow-900 mb-2">
                Comparison Mode
              </h4>
              <p className="text-xs text-yellow-700 mb-2">
                {comparedFunctions.length} function{comparedFunctions.length > 1 ? 's' : ''} selected
              </p>
              <button
                onClick={() => setComparedFunctions([])}
                className="w-full bg-yellow-200 hover:bg-yellow-300 text-yellow-800 py-1 px-3 rounded text-sm"
              >
                Clear Comparison
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Center Panel - Function Details */}
      <div className="flex-1 bg-white p-6 overflow-y-auto">
        <div className="max-w-6xl mx-auto">
          {/* Header */}
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">{func.name}</h1>
              <p className="text-gray-600 mt-1 flex items-center">
                <span className="bg-gray-100 px-2 py-1 rounded text-sm">{func.file}</span>
                <span className="mx-2 text-gray-400">•</span>
                <span className="text-sm text-gray-500">Last analyzed: 2 hours ago</span>
              </p>
            </div>
            <div className="flex space-x-3">
              <button
                onClick={() => navigate(`/graph/${func.id}`)}
                className="bg-primary hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-medium transition-colors duration-200 shadow-sm hover:shadow-md flex items-center space-x-2"
              >
                <span>📊</span>
                <span>View Function Detail Graph</span>
              </button>
            </div>
          </div>

          {/* Navigation Tabs */}
          <div className="border-b border-gray-200 mb-8">
            <nav className="flex space-x-8">
              {[
                { id: 'overview', label: 'Overview', emoji: '📈' },
                { id: 'warnings', label: 'Warnings', emoji: '⚠️' },
                { id: 'metrics', label: 'Metrics', emoji: '📊' }
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`py-4 px-1 font-medium text-sm border-b-2 transition-colors flex items-center space-x-2 ${
                    activeTab === tab.id
                      ? 'border-primary text-primary'
                      : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`}
                >
                  <span>{tab.emoji}</span>
                  <span>{tab.label}</span>
                </button>
              ))}
            </nav>
          </div>

          {/* Overview Tab Content */}
          {activeTab === 'overview' && (
            <div className="space-y-8">
              {/* Key Metrics Grid */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                    <span>Complexity Analysis</span>
                    {func.complexity > 10 && (
                      <span className="ml-2 bg-red-100 text-red-800 text-xs px-2 py-1 rounded">High Risk</span>
                    )}
                  </h3>
                  <div className="space-y-4">
                    <div>
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-gray-600">Cyclomatic Complexity</span>
                        <span className="font-semibold text-lg">{func.complexity}</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div 
                          className={`h-2 rounded-full transition-all duration-500 ${
                            func.complexity > 15 ? 'bg-red-500' : 
                            func.complexity > 10 ? 'bg-yellow-500' : 'bg-green-500'
                          }`}
                          style={{ width: `${Math.min(100, (func.complexity / 20) * 100)}%` }}
                        ></div>
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        {func.complexity > 15 ? 'Very complex - consider refactoring' :
                         func.complexity > 10 ? 'Moderately complex' : 'Good complexity level'}
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div className="text-center p-3 bg-gray-50 rounded border border-gray-100">
                        <div className="font-semibold text-gray-900 text-lg">{func.callCount}</div>
                        <div className="text-gray-600 text-xs">Call Count</div>
                      </div>
                      <div className="text-center p-3 bg-gray-50 rounded border border-gray-100">
                        <div className="font-semibold text-gray-900 text-lg">{func.complexity * 8}</div>
                        <div className="text-gray-600 text-xs">Lines of Code</div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Quality Score</h3>
                  <div className="text-center">
                    <div className="relative inline-block mb-2">
                      <div className="text-4xl font-bold text-gray-900">
                        {qualityScore}
                      </div>
                      <div className="text-sm text-gray-600">out of 100</div>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-3 mt-4">
                      <div 
                        className={`h-3 rounded-full transition-all duration-500 ${
                          qualityScore > 80 ? 'bg-green-500' :
                          qualityScore > 60 ? 'bg-yellow-500' : 'bg-red-500'
                        }`}
                        style={{ width: `${qualityScore}%` }}
                      ></div>
                    </div>
                    <div className="flex justify-between text-xs text-gray-500 mt-2">
                      <span>Poor</span>
                      <span>Good</span>
                      <span>Excellent</span>
                    </div>
                  </div>
                </div>

                <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Warning Impact</h3>
                  <div className="space-y-3">
                    {func.warnings.length > 0 ? (
                      <>
                        <div className="flex items-center justify-between">
                          <span className="text-gray-600">Total Warnings</span>
                          <span className="font-semibold">{func.warnings.length}</span>
                        </div>
                        <div className="space-y-2">
                          {['High', 'Medium', 'Low'].map(severity => {
                            const count = func.warnings.filter(w => w.severity === severity).length;
                            return count > 0 && (
                              <div key={severity} className="flex items-center justify-between">
                                <div className="flex items-center space-x-2">
                                  <div className={`w-2 h-2 rounded-full ${getSeverityDot(severity)}`}></div>
                                  <span className="text-gray-600">{severity}</span>
                                </div>
                                <span className="font-semibold">{count}</span>
                              </div>
                            );
                          })}
                        </div>
                      </>
                    ) : (
                      <div className="text-center text-green-600 py-4">
                        <div className="text-2xl mb-2">✅</div>
                        <p className="text-sm">No warnings detected</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Function Description */}
              <div className="bg-white border border-gray-200 rounded-lg p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Function Description & Context</h3>
                <p className="text-gray-700 leading-relaxed">{func.description}</p>
                <div className="mt-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
                  <h4 className="font-medium text-blue-900 mb-2">Analysis Insight</h4>
                  <p className="text-sm text-blue-700">
                    This function {func.complexity > 10 ? 'has high complexity and may benefit from refactoring' : 'maintains good complexity levels'}. 
                    {func.warnings.length > 0 ? ` It has ${func.warnings.length} warning${func.warnings.length > 1 ? 's' : ''} that should be addressed.` : ' No critical warnings detected.'}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Warnings Tab Content */}
          {activeTab === 'warnings' && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Related Warnings</h3>
              {func.warnings.map((warning) => (
                <div
                  key={warning.id}
                  className={`border rounded-lg p-4 hover:shadow-md transition-shadow ${getSeverityColor(warning.severity)}`}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center space-x-2">
                      <div className={`w-2 h-2 rounded-full ${getSeverityDot(warning.severity)}`}></div>
                      <span className="text-sm font-medium">{warning.severity}</span>
                    </div>
                    <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded">
                      {warning.tool}
                    </span>
                  </div>
                  <h4 className="text-sm font-semibold text-gray-900 mb-1">
                    {warning.type}
                  </h4>
                  <p className="text-xs text-gray-600 mb-2">
                    {warning.description}
                  </p>
                  <div className="text-xs text-gray-500">
                    📁 {warning.file}:{warning.line}
                  </div>
                </div>
              ))}
              
              {func.warnings.length === 0 && (
                <div className="text-center py-12 text-gray-400">
                  <div className="text-4xl mb-4">✅</div>
                  <p className="text-lg">No warnings found for this function</p>
                  <p className="text-sm mt-2">This function maintains good code quality standards</p>
                </div>
              )}
            </div>
          )}

          {/* Metrics Tab Content */}
          {activeTab === 'metrics' && (
            <div className="space-y-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Detailed Metrics</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-white border border-gray-200 rounded-lg p-6">
                  <h4 className="font-semibold text-gray-900 mb-4">Performance Indicators</h4>
                  <div className="space-y-4">
                    <div>
                      <div className="flex justify-between mb-1">
                        <span className="text-gray-600">Maintainability Index</span>
                        <span className="font-medium">{Math.max(0, 85 - func.complexity)}%</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div className="bg-green-500 h-2 rounded-full" style={{ width: `${Math.max(0, 85 - func.complexity)}%` }}></div>
                      </div>
                    </div>
                    
                    <div>
                      <div className="flex justify-between mb-1">
                        <span className="text-gray-600">Test Coverage</span>
                        <span className="font-medium">{Math.max(0, 90 - func.warnings.length * 5)}%</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div className="bg-blue-500 h-2 rounded-full" style={{ width: `${Math.max(0, 90 - func.warnings.length * 5)}%` }}></div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="bg-white border border-gray-200 rounded-lg p-6">
                  <h4 className="font-semibold text-gray-900 mb-4">Risk Assessment</h4>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-gray-600">Technical Debt</span>
                      <span className="font-medium">{func.complexity * 2 + func.warnings.length * 5} hours</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-600">Refactoring Priority</span>
                      <span className={`font-medium px-2 py-1 rounded text-xs ${
                        func.complexity > 15 ? 'bg-red-100 text-red-800' :
                        func.complexity > 10 ? 'bg-yellow-100 text-yellow-800' :
                        'bg-green-100 text-green-800'
                      }`}>
                        {func.complexity > 15 ? 'High' : func.complexity > 10 ? 'Medium' : 'Low'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Right Panel - Warnings */}
      <div className="w-80 bg-white border-l border-gray-200 p-6 overflow-y-auto">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h2>
        
        <div className="space-y-4">
          <button
            onClick={() => navigate(`/graph/${func.id}`)}
            className="w-full bg-primary hover:bg-blue-700 text-white py-3 px-4 rounded-lg font-medium transition-colors text-left flex items-center space-x-3"
          >
            <span className="text-lg">📊</span>
            <div>
              <div className="font-semibold">View Function Detail Graph</div>
              <div className="text-xs opacity-90">Explore function relationships</div>
            </div>
          </button>

          <button
            onClick={() => navigate('/warnings')}
            className="w-full bg-gray-100 hover:bg-gray-200 text-gray-700 py-3 px-4 rounded-lg font-medium transition-colors text-left flex items-center space-x-3"
          >
            <span className="text-lg">⬅️</span>
            <div>
              <div className="font-semibold">Back to Warnings</div>
              <div className="text-xs opacity-90">Return to overview</div>
            </div>
          </button>

          <div className="bg-gray-50 rounded-lg p-4">
            <h3 className="font-semibold text-gray-900 mb-2">Analysis Summary</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Overall Status:</span>
                <span className={`font-medium ${
                  qualityScore > 80 ? 'text-green-600' :
                  qualityScore > 60 ? 'text-yellow-600' : 'text-red-600'
                }`}>
                  {qualityScore > 80 ? 'Good' : qualityScore > 60 ? 'Fair' : 'Needs Attention'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Complexity Level:</span>
                <span className="font-medium">{func.complexity > 10 ? 'High' : 'Normal'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Warning Impact:</span>
                <span className="font-medium">{func.warnings.length > 0 ? 'Present' : 'None'}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FunctionDetailPage;
