import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { mockWarnings, mockFunctions } from '../mockData';
import CallGraph from '../components/CallGraph';

const WarningsPage = () => {
  const navigate = useNavigate();
  const [selectedTool, setSelectedTool] = useState('');
  const [selectedSeverity, setSelectedSeverity] = useState('');
  const [appliedTool, setAppliedTool] = useState('');
  const [appliedSeverity, setAppliedSeverity] = useState('');
  const [hoveredWarning, setHoveredWarning] = useState(null);
  const [selectedWarnings, setSelectedWarnings] = useState([]);
  const [userTask, setUserTask] = useState('exploring');
  const [visibleWarningsCount, setVisibleWarningsCount] = useState(10);
  const [selectedGraphNode, setSelectedGraphNode] = useState(null);
  const [isFilterPanelVisible, setIsFilterPanelVisible] = useState(true);

  // Calculate quality metrics from mock data
  const qualityMetrics = useMemo(() => {
    const totalWarnings = mockWarnings.length;
    const highSeverityWarnings = mockWarnings.filter(w => w.severity === 'High').length;
    const mediumSeverityWarnings = mockWarnings.filter(w => w.severity === 'Medium').length;
    const lowSeverityWarnings = mockWarnings.filter(w => w.severity === 'Low').length;
    
    const complexities = mockFunctions.map(f => f.complexity || 0);
    const avgComplexity = complexities.reduce((a, b) => a + b, 0) / complexities.length;
    const maxComplexity = Math.max(...complexities);
    
    // Calculate overall score (0-100)
    const complexityScore = Math.max(0, 100 - (avgComplexity * 5));
    const severityScore = Math.max(0, 100 - (highSeverityWarnings * 10 + mediumSeverityWarnings * 5));
    const overallScore = Math.round((complexityScore + severityScore) / 2);

    return {
      overallScore,
      avgComplexity: avgComplexity.toFixed(1),
      maxComplexity,
      complexityScore: Math.max(0, 100 - (avgComplexity * 8)),
      securityIssues: mockWarnings.filter(w => w.type.includes('security') || w.type.includes('Security')).length,
      maintainabilityIndex: Math.max(0, 100 - (avgComplexity * 3 + highSeverityWarnings * 2)),
      testCoverage: Math.round(Math.random() * 30 + 60), // Mock data
      issueDistribution: [
        { type: 'High', count: highSeverityWarnings, percentage: Math.round((highSeverityWarnings / totalWarnings) * 100) },
        { type: 'Medium', count: mediumSeverityWarnings, percentage: Math.round((mediumSeverityWarnings / totalWarnings) * 100) },
        { type: 'Low', count: lowSeverityWarnings, percentage: Math.round((lowSeverityWarnings / totalWarnings) * 100) }
      ],
      totalWarnings
    };
  }, [mockWarnings, mockFunctions]);

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
    setVisibleWarningsCount(10);
  };

  // Load more warnings 함수
  const loadMoreWarnings = () => {
    setVisibleWarningsCount(prev => prev + 10);
  };

  // Handle graph node click
  const handleNodeClick = (node) => {
    setSelectedGraphNode(node);
    // Find function by name and navigate to it
    const func = mockFunctions.find(f => f.name === node.name);
    if (func) {
      navigate(`/function/${func.id}`);
    }
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

  const getScoreColor = (score) => {
    if (score >= 80) return 'text-green-600';
    if (score >= 60) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getScoreBgColor = (score) => {
    if (score >= 80) return '#10b981';
    if (score >= 60) return '#f59e0b';
    return '#ef4444';
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
        {/* Filter Panel Toggle Button */}
        <button
          onClick={() => setIsFilterPanelVisible(!isFilterPanelVisible)}
          className={`fixed top-1/2 transform -translate-y-1/2 z-10 bg-primary text-white p-2 rounded-r-lg shadow-lg hover:bg-blue-700 transition-all ${
            isFilterPanelVisible ? 'left-80' : 'left-0'
          }`}
        >
          {isFilterPanelVisible ? '◀' : '▶'}
        </button>

        {/* Left Panel - Filters */}
        {isFilterPanelVisible && (
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
        )}

        {/* Main Content Area - Split between Dashboard and Graph */}
        <div className="flex-1 flex overflow-hidden">
          {/* Left Side - Quality Dashboard & Warning List */}
          <div className="w-[30%] flex flex-col border-r border-gray-200">
            {/* Quality Metrics Dashboard */}
            <div className="bg-white p-6 border-b border-gray-200 overflow-y-auto flex-shrink-0">
              <div className="space-y-6">
                <div>
                  <h1 className="text-2xl font-bold text-gray-900 mb-2">Code Quality Dashboard</h1>
                  <p className="text-gray-600 text-sm">
                    Comprehensive overview of code health metrics and quality indicators
                  </p>
                </div>

                {/* Overall Quality Score */}
                <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-gray-900">Code Health Score</h3>
                    <div className="text-sm text-gray-500">Last analyzed: Today</div>
                  </div>
                  <div className="flex items-center justify-center">
                    <div className="relative">
                      {/* Circular Progress Gauge */}
                      <div 
                        className="w-32 h-32 rounded-full border-8 border-gray-100 flex items-center justify-center"
                        style={{
                          background: `conic-gradient(${getScoreBgColor(qualityMetrics.overallScore)} ${qualityMetrics.overallScore * 3.6}deg, #e5e7eb 0deg)`
                        }}
                      >
                        <div className="w-24 h-24 bg-white rounded-full flex items-center justify-center shadow-sm">
                          <span className={`text-2xl font-bold ${getScoreColor(qualityMetrics.overallScore)}`}>
                            {qualityMetrics.overallScore}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="text-center mt-4">
                    <div className="text-sm text-gray-600">Overall Quality</div>
                    <div className={`text-sm font-medium ${getScoreColor(qualityMetrics.overallScore)}`}>
                      {qualityMetrics.overallScore >= 80 ? 'Excellent' : 
                       qualityMetrics.overallScore >= 60 ? 'Good' : 'Needs Improvement'}
                    </div>
                  </div>
                </div>

                {/* Key Metrics Grid */}
                <div className="grid grid-cols-2 gap-4">
                  {/* Complexity Gauge */}
                  <div className="bg-white rounded-lg border border-gray-200 p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-gray-700">Complexity</span>
                      <span className={`text-xs px-2 py-1 rounded-full ${
                        qualityMetrics.avgComplexity > 15 ? 'bg-red-100 text-red-800' :
                        qualityMetrics.avgComplexity > 10 ? 'bg-yellow-100 text-yellow-800' :
                        'bg-green-100 text-green-800'
                      }`}>
                        {qualityMetrics.avgComplexity > 15 ? 'High' : qualityMetrics.avgComplexity > 10 ? 'Medium' : 'Low'}
                      </span>
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between text-xs">
                        <span>Avg: {qualityMetrics.avgComplexity}</span>
                        <span>Max: {qualityMetrics.maxComplexity}</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div 
                          className={`h-2 rounded-full ${
                            qualityMetrics.avgComplexity > 15 ? 'bg-red-500' :
                            qualityMetrics.avgComplexity > 10 ? 'bg-yellow-500' :
                            'bg-green-500'
                          }`}
                          style={{width: `${Math.min(100, qualityMetrics.complexityScore)}%`}}
                        ></div>
                      </div>
                    </div>
                  </div>

                  {/* Security Issues */}
                  <div className="bg-white rounded-lg border border-gray-200 p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-gray-700">Security</span>
                      <span className={`text-xs px-2 py-1 rounded-full ${
                        qualityMetrics.securityIssues > 5 ? 'bg-red-100 text-red-800' :
                        qualityMetrics.securityIssues > 2 ? 'bg-yellow-100 text-yellow-800' :
                        'bg-green-100 text-green-800'
                      }`}>
                        {qualityMetrics.securityIssues > 5 ? 'Critical' : qualityMetrics.securityIssues > 2 ? 'Medium' : 'Good'}
                      </span>
                    </div>
                    <div className="text-2xl font-bold text-gray-900">{qualityMetrics.securityIssues}</div>
                    <div className="text-xs text-gray-500">Critical vulnerabilities</div>
                  </div>

                  {/* Maintainability */}
                  <div className="bg-white rounded-lg border border-gray-200 p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-gray-700">Maintainability</span>
                      <span className={`text-xs px-2 py-1 rounded-full ${
                        qualityMetrics.maintainabilityIndex > 80 ? 'bg-green-100 text-green-800' :
                        qualityMetrics.maintainabilityIndex > 60 ? 'bg-yellow-100 text-yellow-800' :
                        'bg-red-100 text-red-800'
                      }`}>
                        {qualityMetrics.maintainabilityIndex > 80 ? 'Good' : qualityMetrics.maintainabilityIndex > 60 ? 'Fair' : 'Poor'}
                      </span>
                    </div>
                    <div className="text-2xl font-bold text-gray-900">{qualityMetrics.maintainabilityIndex}</div>
                    <div className="text-xs text-gray-500">Index score</div>
                  </div>

                  {/* Test Coverage */}
                  <div className="bg-white rounded-lg border border-gray-200 p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-gray-700">Test Coverage</span>
                      <span className="text-xs px-2 py-1 rounded-full bg-blue-100 text-blue-800">Target: 80%</span>
                    </div>
                    <div className="space-y-2">
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div 
                          className={`h-2 rounded-full ${
                            qualityMetrics.testCoverage >= 80 ? 'bg-green-500' :
                            qualityMetrics.testCoverage >= 60 ? 'bg-yellow-500' : 'bg-red-500'
                          }`}
                          style={{width: `${qualityMetrics.testCoverage}%`}}
                        ></div>
                      </div>
                      <div className="text-xs text-gray-500">{qualityMetrics.testCoverage}% covered</div>
                    </div>
                  </div>
                </div>

                {/* Issue Distribution */}
                <div className="bg-white rounded-xl border border-gray-200 p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Issue Distribution</h3>
                  <div className="space-y-3">
                    {qualityMetrics.issueDistribution.map((item, index) => (
                      <div key={index} className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          <div className={`w-3 h-3 rounded-full ${
                            item.type === 'High' ? 'bg-red-500' :
                            item.type === 'Medium' ? 'bg-yellow-500' : 'bg-blue-500'
                          }`}></div>
                          <span className="text-sm font-medium text-gray-700">{item.type}</span>
                        </div>
                        <div className="text-right">
                          <div className="text-sm font-semibold text-gray-900">{item.count}</div>
                          <div className="text-xs text-gray-500">{item.percentage}%</div>
                        </div>
                      </div>
                    ))}
                    <div className="pt-3 border-t border-gray-200">
                      <div className="flex justify-between text-sm">
                        <span className="font-medium text-gray-700">Total Issues</span>
                        <span className="font-semibold text-gray-900">{qualityMetrics.totalWarnings}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Warning List */}
            <div className="flex-1 bg-white p-6 overflow-y-auto">
              <div className="space-y-4">
                <div className="text-right mb-6">
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

                <div className="space-y-3 overflow-y-auto pr-2">
                  {filteredAndSortedWarnings.slice(0, visibleWarningsCount).map((warning) => {
                    const functionDetails = getFunctionDetails(warning.function);
                    const functionId = getFunctionId(warning.function);
                    
                    return (
                      <div
                        key={warning.id}
                        className={`border rounded-lg p-3 hover:shadow-md transition-all cursor-pointer ${
                          getSeverityColor(warning.severity)
                        } ${selectedWarnings.includes(warning.id) ? 'ring-2 ring-primary ring-opacity-50' : ''}`}
                        onClick={() => navigate(`/function/${functionId}`)}
                        onMouseEnter={() => setHoveredWarning(warning.id)}
                        onMouseLeave={() => setHoveredWarning(null)}
                      >
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex items-center space-x-2">
                            <div className={`w-2 h-2 rounded-full ${getSeverityDot(warning.severity)}`}></div>
                            <span className="text-sm font-medium">{warning.severity} Severity</span>
                          </div>
                          <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded">{warning.tool}</span>
                        </div>
                        <h4 className="text-sm font-semibold text-gray-900 mb-1">{warning.type}</h4>
                        <p className="text-xs text-gray-600 mb-2 line-clamp-2">{warning.description}</p>
                        <div className="text-xs text-gray-500">
                          📁 {warning.file}:{warning.line}
                        </div>
                        
                        {/* Visual Hover Card */}
                        {hoveredWarning === warning.id && (
                          <div className="bg-white rounded-lg border border-gray-300 p-3 shadow-lg mt-3">
                            <div className="flex items-start justify-between mb-2">
                              <div>
                                <h4 className="font-semibold text-gray-900 text-sm">{warning.type}</h4>
                                <p className="text-xs text-gray-600">{warning.description}</p>
                              </div>
                              <span className="bg-red-100 text-red-800 text-xs px-2 py-1 rounded">High Risk</span>
                            </div>

                            {/* Visual Metrics */}
                            <div className="space-y-2">
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
                                      className={`flex-1 h-1.5 rounded ${
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
                                <div className="flex items-end justify-between h-4 space-x-1">
                                  {[3, 7, 5, 9, 12, functionDetails.callCount, 11].map((value, idx) => (
                                    <div 
                                      key={idx}
                                      className="flex-1 bg-blue-400 rounded-t transition-all hover:bg-blue-500"
                                      style={{ height: `${Math.min(100, (value / 20) * 100)}%` }}
                                    ></div>
                                  ))}
                                </div>
                              </div>
                            </div>

                            {/* Quick Actions */}
                            <div className="flex space-x-2 mt-2 pt-2 border-t border-gray-200">
                              <button 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedWarnings(prev => 
                                    prev.includes(warning.id) 
                                      ? prev.filter(id => id !== warning.id)
                                      : [...prev, warning.id]
                                  );
                                }}
                                className="flex-1 bg-blue-500 hover:bg-blue-600 text-white text-xs py-1 rounded transition-colors"
                              >
                                {selectedWarnings.includes(warning.id) ? 'Selected' : 'Compare'}
                              </button>
                              <button 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  navigate(`/function/${functionId}`);
                                }}
                                className="flex-1 bg-gray-500 hover:bg-gray-600 text-white text-xs py-1 rounded transition-colors"
                              >
                                Analyze
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                  
                  {/* Load More Button */}
                  {visibleWarningsCount < filteredAndSortedWarnings.length && (
                    <div className="pt-4 border-t border-gray-200">
                      <button
                        onClick={loadMoreWarnings}
                        className="w-full bg-gray-100 hover:bg-gray-200 text-gray-700 py-2 px-4 rounded-lg font-medium transition-colors duration-200 text-sm"
                      >
                        See More ({filteredAndSortedWarnings.length - visibleWarningsCount} remaining)
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Graph Panel - Right 70% */}
          <div className="w-[70%] bg-white p-6 overflow-hidden">
            <div className="h-full">
              <div className="mb-4">
                <h2 className="text-xl font-semibold text-gray-900 mb-2">Call Graph Visualization</h2>
                <p className="text-sm text-gray-600">
                  Interactive visualization of function call relationships. Click nodes to analyze functions.
                </p>
              </div>
              <CallGraph 
                selectedFunction={selectedGraphNode?.name}
                onNodeClick={handleNodeClick}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default WarningsPage;