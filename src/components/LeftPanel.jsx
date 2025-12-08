import { useState } from 'react';

const LeftPanel = () => {
  const [nodeSize, setNodeSize] = useState('Complexity');
  const [colorEncoding, setColorEncoding] = useState('Warning Severity');
  const [complexityThreshold, setComplexityThreshold] = useState(50);
  const [warningSeverity, setWarningSeverity] = useState(3);

  const resetFilters = () => {
    setNodeSize('Complexity');
    setColorEncoding('Warning Severity');
    setComplexityThreshold(50);
    setWarningSeverity(3);
  };

  return (
    <div className="w-72 bg-white border-r border-gray-200 p-6 overflow-y-auto">
      <div className="space-y-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Filters</h2>
        
        {/* Node Size Dropdown */}
        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-700">
            Node Size
          </label>
          <select
            value={nodeSize}
            onChange={(e) => setNodeSize(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent transition-colors"
          >
            <option value="Complexity">Complexity</option>
            <option value="Call Degree">Call Degree</option>
          </select>
        </div>

        {/* Color Encoding Dropdown */}
        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-700">
            Color Encoding
          </label>
          <select
            value={colorEncoding}
            onChange={(e) => setColorEncoding(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent transition-colors"
          >
            <option value="Warning Severity">Warning Severity</option>
            <option value="Warning Count">Warning Count</option>
          </select>
        </div>

        {/* Complexity Threshold Slider */}
        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-700">
            Complexity Threshold: {complexityThreshold}
          </label>
          <input
            type="range"
            min="0"
            max="100"
            value={complexityThreshold}
            onChange={(e) => setComplexityThreshold(Number(e.target.value))}
            className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer slider"
          />
          <div className="flex justify-between text-xs text-gray-500">
            <span>0</span>
            <span>100</span>
          </div>
        </div>

        {/* Warning Severity Filter Slider */}
        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-700">
            Warning Severity Filter: {warningSeverity}
          </label>
          <input
            type="range"
            min="1"
            max="5"
            value={warningSeverity}
            onChange={(e) => setWarningSeverity(Number(e.target.value))}
            className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer slider"
          />
          <div className="flex justify-between text-xs text-gray-500">
            <span>Low (1)</span>
            <span>High (5)</span>
          </div>
        </div>

        {/* Apply Filters Button */}
        <button className="w-full bg-primary hover:bg-blue-700 text-white py-2 px-4 rounded-lg font-medium transition-colors duration-200 shadow-sm hover:shadow-md">
          Apply Filters
        </button>

        {/* Reset Button */}
        <button 
          onClick={resetFilters}
          className="w-full bg-gray-200 hover:bg-gray-300 text-gray-700 py-2 px-4 rounded-lg font-medium transition-colors duration-200 shadow-sm hover:shadow-md"
        >
          Reset Filters
        </button>
      </div>
    </div>
  );
};

export default LeftPanel;
