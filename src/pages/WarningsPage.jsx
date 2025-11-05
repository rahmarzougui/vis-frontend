import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { mockWarnings, mockFunctions, mockNodes } from '../mockData';
import CallGraph from '../components/CallGraph';

// Step 1: Exploration Criteria Presets
const EXPLORATION_CRITERIA = [
  { 
    id: 'complexity', 
    label: 'Functions with High Complexity', 
    description: 'Focus on complex functions that need refactoring',
    icon: '📊'
  },
  { 
    id: 'high-severity', 
    label: 'Functions with Many High-Severity Warnings', 
    description: 'Identify critical issues that need immediate attention',
    icon: '🔴'
  },
  { 
    id: 'easy-fix', 
    label: 'Functions with Many Easy-to-Fix Warnings', 
    description: 'Quick wins for improving code quality',
    icon: '⚡'
  }
];

// Step 2: Dynamic Filter Configuration based on selected criteria
const getFilterConfig = (criteriaId) => {
  const baseConfig = {
    complexity: [
      {
        key: 'minComplexity',
        label: 'Minimum Complexity Score',
        type: 'slider',
        min: 5,
        max: 20,
        step: 1,
        defaultValue: 10
      },
      {
        key: 'warningSeverity',
        label: 'Warning Severity Focus',
        type: 'select',
        options: [
          { value: 'any', label: 'Any Severity' },
          { value: 'High', label: 'High Severity Only' },
          { value: 'Medium', label: 'Medium+ Severity' },
          { value: 'Low', label: 'Low+ Severity' }
        ],
        defaultValue: 'any'
      },
      {
        key: 'minWarningCount',
        label: 'Minimum Warning Count',
        type: 'slider',
        min: 0,
        max: 10,
        step: 1,
        defaultValue: 1
      },
      {
        key: 'minDegree',
        label: 'Minimum Connection Degree',
        type: 'slider',
        min: 0,
        max: 10,
        step: 1,
        defaultValue: 2
      }
    ],
    'high-severity': [
      {
        key: 'minHighSeverityCount',
        label: 'Minimum High-Severity Warnings',
        type: 'slider',
        min: 1,
        max: 5,
        step: 1,
        defaultValue: 2
      },
      {
        key: 'includeMediumSeverity',
        label: 'Include Medium Severity',
        type: 'toggle',
        defaultValue: false
      },
      {
        key: 'minComplexity',
        label: 'Minimum Complexity',
        type: 'slider',
        min: 0,
        max: 15,
        step: 1,
        defaultValue: 5
      },
      {
        key: 'minTotalWarnings',
        label: 'Minimum Total Warnings',
        type: 'slider',
        min: 0,
        max: 10,
        step: 1,
        defaultValue: 3
      }
    ],
    'easy-fix': [
      {
        key: 'minEasyFixCount',
        label: 'Minimum Easy-to-Fix Warnings',
        type: 'slider',
        min: 1,
        max: 8,
        step: 1,
        defaultValue: 3
      },
      {
        key: 'maxComplexity',
        label: 'Maximum Complexity',
        type: 'slider',
        min: 5,
        max: 20,
        step: 1,
        defaultValue: 12
      },
      {
        key: 'easyFixRatio',
        label: 'Easy Fix Ratio',
        type: 'slider',
        min: 0.1,
        max: 1.0,
        step: 0.1,
        defaultValue: 0.5
      },
      {
        key: 'minTotalWarnings',
        label: 'Minimum Total Warnings',
        type: 'slider',
        min: 0,
        max: 10,
        step: 1,
        defaultValue: 2
      }
    ]
  };

  return baseConfig[criteriaId] || [];
};

const WarningsPage = () => {
  const navigate = useNavigate();
  
  // Step 1 State: Selected exploration criteria
  const [selectedCriteria, setSelectedCriteria] = useState('complexity');
  
  // Step 2 State: Dynamic filters based on criteria
  const [filters, setFilters] = useState({});
  
  // Step 3 State: Selected function for graph highlighting
  const [selectedFunction, setSelectedFunction] = useState(null);
  
  const [isLeftPanelOpen, setIsLeftPanelOpen] = useState(true);

  // Calculate function metrics for filtering and display
  const functionMetrics = useMemo(() => {
    const degreeMap = mockNodes.reduce((acc, node) => {
      acc[node.id] = node.degree || 0;
      return acc;
    }, {});

    return mockFunctions.map(func => {
      const functionWarnings = mockWarnings.filter(w => w.function === func.name);
      
      const severityCounts = functionWarnings.reduce((acc, warning) => {
        acc[warning.severity] = (acc[warning.severity] || 0) + 1;
        return acc;
      }, { High: 0, Medium: 0, Low: 0 });

      const totalWarnings = functionWarnings.length;
      const easyFixCount = severityCounts.Low + Math.floor(severityCounts.Medium * 0.3);
      const easyFixRatio = totalWarnings > 0 ? easyFixCount / totalWarnings : 0;

      return {
        ...func,
        functionWarnings,
        totalWarnings,
        severityCounts,
        easyFixCount,
        easyFixRatio,
        degree: degreeMap[func.name] || 0,
        dominantSeverity: severityCounts.High > 0 ? 'High' : 
                         severityCounts.Medium > 0 ? 'Medium' : 
                         severityCounts.Low > 0 ? 'Low' : 'None'
      };
    });
  }, [mockWarnings, mockFunctions, mockNodes]);

  // Initialize filters when criteria changes
  useMemo(() => {
    const config = getFilterConfig(selectedCriteria);
    const initialFilters = {};
    config.forEach(filter => {
      initialFilters[filter.key] = filter.defaultValue;
    });
    setFilters(initialFilters);
  }, [selectedCriteria]);

  // Step 3: Filter functions based on selected criteria and filters
  const filteredFunctions = useMemo(() => {
    let results = [...functionMetrics];

    switch (selectedCriteria) {
      case 'complexity':
        // Filter by complexity criteria
        results = results.filter(func => 
          func.complexity >= Number(filters.minComplexity || 5)
        );
        
        if (filters.warningSeverity && filters.warningSeverity !== 'any') {
          if (filters.warningSeverity === 'High') {
            results = results.filter(func => func.severityCounts.High > 0);
          } else if (filters.warningSeverity === 'Medium') {
            results = results.filter(func => func.severityCounts.High > 0 || func.severityCounts.Medium > 0);
          } else if (filters.warningSeverity === 'Low') {
            results = results.filter(func => func.totalWarnings > 0);
          }
        }
        
        if (filters.minWarningCount) {
          results = results.filter(func => func.totalWarnings >= Number(filters.minWarningCount));
        }
        
        if (filters.minDegree) {
          results = results.filter(func => func.degree >= Number(filters.minDegree));
        }
        
        // Sort by complexity (highest first)
        results.sort((a, b) => b.complexity - a.complexity);
        break;

      case 'high-severity':
        // Filter by high-severity criteria
        results = results.filter(func => 
          func.severityCounts.High >= Number(filters.minHighSeverityCount || 1)
        );
        
        if (!filters.includeMediumSeverity) {
          results = results.filter(func => func.severityCounts.Medium === 0);
        }
        
        if (filters.minComplexity) {
          results = results.filter(func => func.complexity >= Number(filters.minComplexity));
        }
        
        if (filters.minTotalWarnings) {
          results = results.filter(func => func.totalWarnings >= Number(filters.minTotalWarnings));
        }
        
        // Sort by high severity count (highest first)
        results.sort((a, b) => b.severityCounts.High - a.severityCounts.High);
        break;

      case 'easy-fix':
        // Filter by easy-fix criteria
        results = results.filter(func => 
          func.easyFixCount >= Number(filters.minEasyFixCount || 2)
        );
        
        if (filters.maxComplexity) {
          results = results.filter(func => func.complexity <= Number(filters.maxComplexity));
        }
        
        if (filters.easyFixRatio) {
          results = results.filter(func => func.easyFixRatio >= Number(filters.easyFixRatio));
        }
        
        if (filters.minTotalWarnings) {
          results = results.filter(func => func.totalWarnings >= Number(filters.minTotalWarnings));
        }
        
        // Sort by easy fix count (highest first)
        results.sort((a, b) => b.easyFixCount - a.easyFixCount);
        break;
    }

    return results;
  }, [functionMetrics, selectedCriteria, filters]);

  // Event Handlers
  const handleCriteriaSelect = (criteriaId) => {
    setSelectedCriteria(criteriaId);
    setSelectedFunction(null); // Reset selection when criteria changes
  };

  const handleFilterChange = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const handleFunctionSelect = (functionName) => {
    setSelectedFunction(prev => prev === functionName ? null : functionName);
  };

  const handleNodeClick = (node) => {
    if (node) {
      setSelectedFunction(prev => prev === node.id ? null : node.id);
    }
  };

  // Render filter controls based on type
  const renderFilterControl = (filterConfig) => {
    const value = filters[filterConfig.key] ?? filterConfig.defaultValue;

    switch (filterConfig.type) {
      case 'slider':
        return (
          <div key={filterConfig.key} className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">
              {filterConfig.label}: <span className="text-primary font-semibold">{value}</span>
            </label>
            <input
              type="range"
              min={filterConfig.min}
              max={filterConfig.max}
              step={filterConfig.step}
              value={value}
              onChange={(e) => handleFilterChange(filterConfig.key, e.target.value)}
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
            />
            <div className="flex justify-between text-xs text-gray-500">
              <span>{filterConfig.min}</span>
              <span>{filterConfig.max}</span>
            </div>
          </div>
        );

      case 'select':
        return (
          <div key={filterConfig.key} className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">
              {filterConfig.label}
            </label>
            <select
              value={value}
              onChange={(e) => handleFilterChange(filterConfig.key, e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent text-sm"
            >
              {filterConfig.options.map(option => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        );

      case 'toggle':
        return (
          <div key={filterConfig.key} className="flex items-center justify-between">
            <label className="text-sm font-medium text-gray-700">
              {filterConfig.label}
            </label>
            <button
              onClick={() => handleFilterChange(filterConfig.key, !value)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                value ? 'bg-primary' : 'bg-gray-200'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${
                  value ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-73px)] bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Function Explorer</h1>
            <p className="text-sm text-gray-600">
              Explore functions based on different quality criteria and analyze their impact
            </p>
          </div>
          {selectedFunction && (
            <div className="text-sm text-gray-600">
              Selected: <span className="font-semibold text-primary">{selectedFunction}</span>
            </div>
          )}
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Left Panel - Exploration Interface */}
        <div className={`relative bg-white border-r border-gray-200 transition-all duration-300 ${
          isLeftPanelOpen ? 'w-96' : 'w-0'
        }`}>
          <button
            onClick={() => setIsLeftPanelOpen(!isLeftPanelOpen)}
            className="absolute top-6 -right-3 z-10 bg-primary text-white rounded-full shadow-lg w-6 h-6 flex items-center justify-center text-sm hover:scale-105 transition-transform"
          >
            {isLeftPanelOpen ? '◀' : '▶'}
          </button>
          
          {isLeftPanelOpen && (
            <div className="h-full p-6 overflow-y-auto">
              <div className="space-y-8">
                {/* Step 1: Exploration Criteria Selection */}
                <section>
                  <h2 className="text-lg font-semibold text-gray-900 mb-4">
                    Step 1: Choose Exploration Focus
                  </h2>
                  <div className="space-y-3">
                    {EXPLORATION_CRITERIA.map(criteria => (
                      <button
                        key={criteria.id}
                        onClick={() => handleCriteriaSelect(criteria.id)}
                        className={`w-full text-left p-4 rounded-xl border-2 transition-all ${
                          selectedCriteria === criteria.id
                            ? 'border-primary bg-blue-50 shadow-sm'
                            : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                        }`}
                      >
                        <div className="flex items-start space-x-3">
                          <span className="text-xl">{criteria.icon}</span>
                          <div className="flex-1">
                            <h3 className="font-semibold text-gray-900 text-sm">
                              {criteria.label}
                            </h3>
                            <p className="text-xs text-gray-500 mt-1">
                              {criteria.description}
                            </p>
                          </div>
                          {selectedCriteria === criteria.id && (
                            <div className="w-2 h-2 bg-primary rounded-full"></div>
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                </section>

                {/* Step 2: Dynamic Filters */}
                <section>
                  <h2 className="text-lg font-semibold text-gray-900 mb-4">
                    Step 2: Refine Your Selection
                  </h2>
                  <div className="space-y-4 p-4 bg-gray-50 rounded-lg">
                    {getFilterConfig(selectedCriteria).map(renderFilterControl)}
                  </div>
                </section>

                {/* Step 3: Filtered Function List */}
                <section>
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-lg font-semibold text-gray-900">
                      Step 3: Explore Functions
                    </h2>
                    <span className="text-sm text-gray-500 bg-white px-2 py-1 rounded">
                      {filteredFunctions.length} found
                    </span>
                  </div>
                  
                  <div className="space-y-3 max-h-96 overflow-y-auto">
                    {filteredFunctions.slice(0, 20).map(func => {
                      const isSelected = selectedFunction === func.name;
                      return (
                        <div
                          key={func.id}
                          onClick={() => handleFunctionSelect(func.name)}
                          className={`p-4 rounded-lg border cursor-pointer transition-all ${
                            isSelected
                              ? 'border-primary bg-blue-50 shadow-md'
                              : 'border-gray-200 hover:border-primary hover:shadow-sm'
                          }`}
                        >
                          <div className="flex items-start justify-between mb-2">
                            <div className="flex-1">
                              <h3 className={`font-semibold text-sm ${
                                isSelected ? 'text-primary' : 'text-gray-900'
                              }`}>
                                {func.name}
                              </h3>
                              <p className="text-xs text-gray-500 truncate">
                                {func.file}
                              </p>
                            </div>
                            <div className="text-right">
                              <div className="text-lg font-bold text-gray-900">
                                {func.complexity}
                              </div>
                              <div className="text-xs text-gray-400">Complexity</div>
                            </div>
                          </div>

                          {/* Metrics Overview */}
                          <div className="grid grid-cols-3 gap-2 text-xs mb-3">
                            <div className={`text-center rounded px-2 py-1 ${
                              isSelected ? 'bg-white' : 'bg-gray-100'
                            }`}>
                              ⚠️ {func.totalWarnings}
                            </div>
                            <div className={`text-center rounded px-2 py-1 ${
                              isSelected ? 'bg-white' : 'bg-gray-100'
                            }`}>
                              📊 {func.degree}
                            </div>
                            <div className={`text-center rounded px-2 py-1 ${
                              isSelected ? 'bg-white' : 'bg-gray-100'
                            }`}>
                              ⚡ {func.easyFixCount}
                            </div>
                          </div>

                          {/* Severity Breakdown */}
                          <div className="flex flex-wrap gap-1 text-xs">
                            {Object.entries(func.severityCounts).map(([severity, count]) => 
                              count > 0 && (
                                <span
                                  key={severity}
                                  className={`inline-flex items-center px-2 py-0.5 rounded-full ${
                                    severity === 'High' ? 'bg-red-100 text-red-800' :
                                    severity === 'Medium' ? 'bg-yellow-100 text-yellow-800' :
                                    'bg-blue-100 text-blue-800'
                                  }`}
                                >
                                  {severity[0]}: {count}
                                </span>
                              )
                            )}
                          </div>
                        </div>
                      );
                    })}
                    
                    {filteredFunctions.length === 0 && (
                      <div className="text-center text-gray-400 py-8 border-2 border-dashed rounded-lg">
                        No functions match your current criteria
                        <div className="text-xs mt-2">Try adjusting your filters</div>
                      </div>
                    )}
                  </div>
                </section>
              </div>
            </div>
          )}
        </div>

        {/* Right Panel - Call Graph */}
        <div className="flex-1 bg-white p-6 overflow-hidden">
          <div className="h-full flex flex-col">
            <div className="mb-4">
              <h2 className="text-xl font-semibold text-gray-900 mb-2">
                Call Graph Visualization
              </h2>
              <p className="text-sm text-gray-600">
                {selectedFunction 
                  ? `Analyzing impact and relationships of ${selectedFunction}`
                  : 'Select a function from the list to explore its call relationships and impact'
                }
              </p>
            </div>
            
            <div className="flex-1 border rounded-lg bg-gray-50">
              <CallGraph 
                selectedFunction={selectedFunction}
                onNodeClick={handleNodeClick}
                highlightedFunctions={new Set(filteredFunctions.map(f => f.name))}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default WarningsPage;