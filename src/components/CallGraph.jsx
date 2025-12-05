import React, { useCallback, useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import { mockData } from '../mockData';

const CallGraph = ({ selectedFunction = null, onNodeClick = null, selectedPreset = 'complexity', functionsWithMetrics = [] }) => {
  const svgRef = useRef();
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const [depthLevel, setDepthLevel] = useState(1);
  const nodeSelectionRef = useRef(null);
  const linkSelectionRef = useRef(null);
  const nodesDataRef = useRef([]);
  const edgesDataRef = useRef([]);
  const selectedFunctionRef = useRef(selectedFunction);
  const onNodeClickRef = useRef(onNodeClick);
  const tooltipRef = useRef(null);
  const isRenderingRef = useRef(false);
  const functionsWithMetricsRef = useRef(functionsWithMetrics);
  const simulationRef = useRef(null);

  useEffect(() => {
    const svgElement = svgRef.current;
    if (!svgElement) return;

    const updateDimensions = () => {
      const rect = svgElement.getBoundingClientRect();
      setDimensions(prev => {
        if (prev.width === rect.width && prev.height === rect.height) {
          return prev;
        }
        return { width: rect.width, height: rect.height };
      });
    };

    updateDimensions();
    window.addEventListener('resize', updateDimensions);

    let resizeObserver;
    if (typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(entries => {
        for (const entry of entries) {
          if (entry.target === svgElement) {
            const { width, height } = entry.contentRect;
            setDimensions(prev => {
              if (prev.width === width && prev.height === height) {
                return prev;
              }
              return { width, height };
            });
          }
        }
      });
      resizeObserver.observe(svgElement);
    }

    return () => {
      window.removeEventListener('resize', updateDimensions);
      if (resizeObserver) {
        resizeObserver.disconnect();
      }
    };
  }, []);

  const getDatumId = useCallback((endpoint) => (
    typeof endpoint === 'string' ? endpoint : endpoint.id
  ), []);

  // Calculate nodes within depth level using BFS
  const getNodesWithinDepth = useCallback((selectedId, depth, edges, allNodes) => {
    if (!selectedId || depth === 0) {
      // Return all nodes if depth is 0 (unlimited) or no selection
      return new Set(allNodes.map(n => n.id));
    }

    // Build adjacency list (undirected graph)
    const adjacencyList = new Map();
    allNodes.forEach(node => {
      adjacencyList.set(node.id, []);
    });

    edges.forEach(edge => {
      const sourceId = getDatumId(edge.source);
      const targetId = getDatumId(edge.target);
      if (!adjacencyList.get(sourceId).includes(targetId)) {
        adjacencyList.get(sourceId).push(targetId);
      }
      if (!adjacencyList.get(targetId).includes(sourceId)) {
        adjacencyList.get(targetId).push(sourceId);
      }
    });

    // BFS to find nodes within depth level
    const visited = new Set();
    const result = new Set();
    const queue = [{ nodeId: selectedId, level: 0 }];
    visited.add(selectedId);
    result.add(selectedId);

    while (queue.length > 0) {
      const { nodeId, level } = queue.shift();
      
      if (level >= depth) continue;

      const neighbors = adjacencyList.get(nodeId) || [];
      neighbors.forEach(neighborId => {
        if (!visited.has(neighborId)) {
          visited.add(neighborId);
          result.add(neighborId);
          queue.push({ nodeId: neighborId, level: level + 1 });
        }
      });
    }

    return result;
  }, [getDatumId]);

  const applyHighlight = useCallback((selectedId, depth) => {
    const nodeSelection = nodeSelectionRef.current;
    const linkSelection = linkSelectionRef.current;
    const edges = edgesDataRef.current;
    const nodes = nodesDataRef.current;

    if (!nodeSelection || !linkSelection) return;

    // Get nodes within depth level
    const nodesWithinDepth = getNodesWithinDepth(selectedId, depth, edges, nodes);
    
    const highlightedEdgeKeys = new Set();
    const createEdgeKey = (source, target) => `${source}->${target}`;

    // Build highlighted edges (only edges between nodes within depth)
    edges.forEach(edge => {
      const sourceId = getDatumId(edge.source);
      const targetId = getDatumId(edge.target);
      if (nodesWithinDepth.has(sourceId) && nodesWithinDepth.has(targetId)) {
        highlightedEdgeKeys.add(createEdgeKey(sourceId, targetId));
      }
    });

    // Update node visibility and styling
    nodeSelection
      .style('display', 'block') // Always show all nodes
      .attr('opacity', d => {
        if (!selectedId) return 1;
        if (d.id === selectedId) return 1;
        return nodesWithinDepth.has(d.id) ? 1 : 0.3; // Gray out non-highlighted nodes
      })
      .select('circle')
      .attr('fill', d => {
        if (!selectedId) return '#60a5fa';
        if (d.id === selectedId) return '#2563eb';
        if (nodesWithinDepth.has(d.id)) return '#93c5fd';
        return '#9ca3af'; // Gray color for non-highlighted nodes
      })
      .attr('stroke', d => {
        if (!selectedId) return '#ffffff';
        if (d.id === selectedId) return '#1d4ed8';
        if (nodesWithinDepth.has(d.id)) return '#1e40af';
        return '#d1d5db'; // Light gray stroke for non-highlighted nodes
      })
      .attr('stroke-width', d => (selectedId && d.id === selectedId ? 3 : 2));
    
    // Update text styling for non-highlighted nodes
    // We need to iterate through each node group to update text
    nodeSelection.each(function(d) {
      const nodeGroup = d3.select(this);
      const isHighlighted = !selectedId || d.id === selectedId || nodesWithinDepth.has(d.id);
      const textColor = isHighlighted ? '#333' : '#9ca3af';
      const metricColor = isHighlighted ? '#666' : '#9ca3af';
      
      nodeGroup.select('text.node-name-text')
        .attr('fill', textColor);
      
      nodeGroup.select('text.metric-text')
        .attr('fill', metricColor);
    });

    // Update link visibility and styling
    linkSelection
      .style('display', 'block') // Always show all links
      .attr('opacity', d => {
        if (!selectedId) return 0.6;
        const key = createEdgeKey(getDatumId(d.source), getDatumId(d.target));
        return highlightedEdgeKeys.has(key) ? 0.9 : 0.2; // Gray out non-highlighted links
      })
      .attr('stroke', d => {
        if (!selectedId) return '#999';
        const key = createEdgeKey(getDatumId(d.source), getDatumId(d.target));
        return highlightedEdgeKeys.has(key) ? '#2563eb' : '#d1d5db'; // Gray color for non-highlighted links
      })
      .attr('stroke-opacity', d => {
        if (!selectedId) return 0.6;
        const key = createEdgeKey(getDatumId(d.source), getDatumId(d.target));
        return highlightedEdgeKeys.has(key) ? 0.9 : 0.2; // Lower opacity for non-highlighted links
      });
  }, [getDatumId, getNodesWithinDepth]);

  // Update refs when props change (without triggering re-render)
  useEffect(() => {
    functionsWithMetricsRef.current = functionsWithMetrics;
  }, [functionsWithMetrics]);

  useEffect(() => {
    if (dimensions.width === 0 || dimensions.height === 0) return;

    // Stop any existing simulation first
    if (simulationRef.current) {
      simulationRef.current.stop();
      simulationRef.current = null;
    }

    // Set rendering flag to prevent event handlers from firing during render
    isRenderingRef.current = true;

    // Remove any existing tooltips before rendering
    if (tooltipRef.current) {
      d3.select(tooltipRef.current).remove();
      tooltipRef.current = null;
    }
    d3.selectAll('.tooltip').remove();

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove(); // 초기화
    
    // Temporarily disable pointer events on the SVG to prevent mouse events during render
    svg.style('pointer-events', 'none');

    const nodes = mockData.nodes.map(node => ({ ...node }));
    const edges = mockData.edges.map(edge => ({ ...edge }));

    nodesDataRef.current = nodes;
    edgesDataRef.current = edges;

    const simulation = d3.forceSimulation(nodes)
      .force('link', d3.forceLink(edges).id(d => d.id).distance(100))
      .force('charge', d3.forceManyBody().strength(-300))
      .force('center', d3.forceCenter(dimensions.width / 2, dimensions.height / 2))
      .force('collision', d3.forceCollide().radius(30));
    
    simulationRef.current = simulation;

    const container = svg.append('g');

    const zoom = d3.zoom()
      .scaleExtent([0.1, 4])
      .on('zoom', (event) => {
        if (isRenderingRef.current) {
          event.sourceEvent?.preventDefault();
          event.sourceEvent?.stopPropagation();
          return;
        }
        container.attr('transform', event.transform);
      });

    svg.call(zoom);

    svg.append('defs').append('marker')
      .attr('id', 'arrowhead')
      .attr('viewBox', '-0 -5 10 10')
      .attr('refX', 25)
      .attr('refY', 0)
      .attr('orient', 'auto')
      .append('path')
      .attr('d', 'M 0,-5 L 10 ,0 L 0,5')
      .attr('fill', '#94a3b8');

    const link = container.append('g')
      .attr('class', 'links')
      .selectAll('line')
      .data(edges)
      .enter().append('line')
      .attr('stroke-width', 2)
      .attr('marker-end', 'url(#arrowhead)');

    const node = container.append('g')
      .attr('class', 'nodes')
      .selectAll('g')
      .data(nodes)
      .enter().append('g')
      .attr('class', 'node')
      .style('cursor', 'pointer')
      .style('pointer-events', 'none') // Disable pointer events during render
      .call(d3.drag()
        .on('start', dragstarted)
        .on('drag', dragged)
        .on('end', dragended));

    node.append('circle')
      .attr('r', d => Math.max(15, Math.min(25, d.degree * 2)));

    const nameText = node.append('text')
      .attr('dx', 0)
      .attr('dy', 5)
      .attr('text-anchor', 'middle')
      .attr('font-size', '10px')
      .attr('font-weight', 'bold')
      .attr('fill', '#333')
      .attr('class', 'node-name-text')
      .text(d => d.name.length > 8 ? d.name.substring(0, 8) + '...' : d.name);

    // Get function data for each node
    const getNodeFunctionData = (nodeId) => {
      return functionsWithMetricsRef.current.find(func => func.name === nodeId);
    };

    // Get display text based on preset
    const getNodeDisplayText = (nodeId) => {
      const funcData = getNodeFunctionData(nodeId);
      if (!funcData) return `deg: ${nodes.find(n => n.id === nodeId)?.degree || 0}`;
      
      switch (selectedPreset) {
        case 'complexity':
          return `CC: ${funcData.complexity}`;
        case 'severity':
          return `H: ${funcData.severityCounts.High || 0}`;
        case 'easy':
          return `E: ${funcData.easyFixCount || 0}`;
        default:
          return `deg: ${funcData.degree || 0}`;
      }
    };

    const metricText = node.append('text')
      .attr('dx', 0)
      .attr('dy', 18)
      .attr('text-anchor', 'middle')
      .attr('font-size', '8px')
      .attr('fill', '#666')
      .attr('class', 'metric-text')
      .text(d => getNodeDisplayText(d.id));

    node
      .on('mouseover', function(event, d) {
        // Prevent tooltip and hover effects during initial render
        if (isRenderingRef.current) return;

        if (!selectedFunctionRef.current) {
          const connectedNodes = new Set();
          edgesDataRef.current.forEach(edge => {
            const sourceId = getDatumId(edge.source);
            const targetId = getDatumId(edge.target);
            if (sourceId === d.id) connectedNodes.add(targetId);
            if (targetId === d.id) connectedNodes.add(sourceId);
          });

          node.select('circle')
            .attr('opacity', n =>
              n.id === d.id || connectedNodes.has(n.id) ? 1 : 0.3
            );

          link
            .attr('stroke-opacity', e =>
              getDatumId(e.source) === d.id || getDatumId(e.target) === d.id ? 0.9 : 0.1
            )
            .attr('stroke', e =>
              getDatumId(e.source) === d.id || getDatumId(e.target) === d.id ? '#2563eb' : '#cbd5f5'
            );
        }
        // When a function is selected, don't change the view on hover
        // Just show the tooltip - depth filtering stays based on selected function

        // Remove any existing tooltip first
        if (tooltipRef.current) {
          d3.select(tooltipRef.current).remove();
          tooltipRef.current = null;
        }

        const tooltip = d3.select('body').append('div')
          .attr('class', 'tooltip')
          .style('position', 'absolute')
          .style('background', 'rgba(0,0,0,0.8)')
          .style('color', 'white')
          .style('padding', '8px')
          .style('border-radius', '4px')
          .style('font-size', '12px')
          .style('pointer-events', 'none')
          .style('z-index', '1000');

        tooltipRef.current = tooltip.node();

        // Get function data for tooltip
        const funcData = functionsWithMetricsRef.current.find(func => func.name === d.id);
        
        let tooltipContent = `<strong>${d.name}</strong><br/>`;
        
        if (funcData) {
          switch (selectedPreset) {
            case 'complexity':
              tooltipContent += `
                Complexity: ${funcData.complexity}<br/>
                Warnings: ${funcData.warningCount}<br/>
                Degree: ${funcData.degree}<br/>
                File: ${funcData.file}
              `;
              break;
            case 'severity':
              tooltipContent += `
                High: ${funcData.severityCounts.High || 0}<br/>
                Medium: ${funcData.severityCounts.Medium || 0}<br/>
                Low: ${funcData.severityCounts.Low || 0}<br/>
                Total: ${funcData.warningCount}<br/>
                Complexity: ${funcData.complexity}
              `;
              break;
            case 'easy':
              tooltipContent += `
                Easy Fixes: ${funcData.easyFixCount || 0}<br/>
                Complexity: ${funcData.complexity}<br/>
                Total Warnings: ${funcData.warningCount}<br/>
                Degree: ${funcData.degree}
              `;
              break;
            default:
              tooltipContent += `
                In-degree: ${d.in_degree}<br/>
                Out-degree: ${d.out_degree}<br/>
                Total degree: ${d.degree}
              `;
          }
        } else {
          tooltipContent += `
            In-degree: ${d.in_degree}<br/>
            Out-degree: ${d.out_degree}<br/>
            Total degree: ${d.degree}
          `;
        }

        tooltip.html(tooltipContent);
      })
      .on('mousemove', function(event) {
        // Prevent tooltip updates during initial render
        if (isRenderingRef.current) return;
        if (tooltipRef.current) {
          d3.select(tooltipRef.current)
            .style('left', (event.pageX + 10) + 'px')
            .style('top', (event.pageY - 10) + 'px');
        }
      })
      .on('mouseout', () => {
        // Prevent mouseout effects during initial render
        if (isRenderingRef.current) return;
        if (!selectedFunctionRef.current) {
          node.select('circle').attr('opacity', 1);
          link
            .attr('stroke', '#999')
            .attr('stroke-opacity', 0.6);
        }
        // When a function is selected, view doesn't change on hover/mouseout
        // No need to restore anything - depth filtering is always based on selected function
        if (tooltipRef.current) {
          d3.select(tooltipRef.current).remove();
          tooltipRef.current = null;
        }
      })
      .on('click', function(event, d) {
        // Prevent click handling during initial render
        if (isRenderingRef.current) return;
        // Remove tooltip when clicking on a node
        if (tooltipRef.current) {
          d3.select(tooltipRef.current).remove();
          tooltipRef.current = null;
        }
        const handler = onNodeClickRef.current;
        if (handler) {
          handler(d);
        }
      });

    simulation.on('tick', () => {
      link
        .attr('x1', d => d.source.x)
        .attr('y1', d => d.source.y)
        .attr('x2', d => d.target.x)
        .attr('y2', d => d.target.y);

      node
        .attr('transform', d => `translate(${d.x},${d.y})`);
    });

    function dragstarted(event, d) {
      if (isRenderingRef.current) {
        event.sourceEvent.preventDefault();
        event.sourceEvent.stopPropagation();
        return;
      }
      if (!event.active) simulation.alphaTarget(0.3).restart();
      d.fx = d.x;
      d.fy = d.y;
    }

    function dragged(event, d) {
      if (isRenderingRef.current) {
        event.sourceEvent.preventDefault();
        event.sourceEvent.stopPropagation();
        return;
      }
      d.fx = event.x;
      d.fy = event.y;
    }

    function dragended(event, d) {
      if (isRenderingRef.current) {
        event.sourceEvent.preventDefault();
        event.sourceEvent.stopPropagation();
        return;
      }
      if (!event.active) simulation.alphaTarget(0);
      d.fx = null;
      d.fy = null;
    }

    nodeSelectionRef.current = node;
    linkSelectionRef.current = link;
    applyHighlight(selectedFunctionRef.current, depthLevel);

    // Wait for simulation to settle before enabling interactions
    let renderTimeout;
    let hasEnabled = false;
    
    const enableInteractions = () => {
      if (hasEnabled) return; // Prevent multiple calls
      hasEnabled = true;
      isRenderingRef.current = false;
      svg.style('pointer-events', 'auto');
      // Re-enable pointer events on nodes using the ref
      if (nodeSelectionRef.current) {
        nodeSelectionRef.current.style('pointer-events', 'auto');
      }
    };

    // Fallback: enable interactions after 2 seconds even if simulation hasn't ended
    renderTimeout = setTimeout(enableInteractions, 2000);

    // Wait for simulation to complete initial positioning
    simulation.on('end', () => {
      clearTimeout(renderTimeout);
      // Add a small delay after simulation ends to ensure DOM is fully ready
      renderTimeout = setTimeout(enableInteractions, 100);
    });

    return () => {
      clearTimeout(renderTimeout);
      if (simulationRef.current) {
        simulationRef.current.stop();
        simulationRef.current = null;
      }
      nodeSelectionRef.current = null;
      linkSelectionRef.current = null;
      isRenderingRef.current = false;
      // Re-enable pointer events in case cleanup happens during render
      const svg = d3.select(svgRef.current);
      if (svg.node()) {
        svg.style('pointer-events', 'auto');
      }
      // Re-enable pointer events on nodes
      if (nodeSelectionRef.current) {
        nodeSelectionRef.current.style('pointer-events', 'auto');
      }
      // Clean up any lingering tooltips
      if (tooltipRef.current) {
        d3.select(tooltipRef.current).remove();
        tooltipRef.current = null;
      }
      // Also remove any tooltips by class name as a fallback
      d3.selectAll('.tooltip').remove();
    };
  }, [dimensions, applyHighlight, getDatumId, depthLevel, selectedPreset]);

  useEffect(() => {
    onNodeClickRef.current = onNodeClick;
  }, [onNodeClick]);

  useEffect(() => {
    selectedFunctionRef.current = selectedFunction;
    if (!selectedFunction) {
      setDepthLevel(1); // Reset depth when no function is selected
    }
    // Remove tooltip when selected function changes
    if (tooltipRef.current) {
      d3.select(tooltipRef.current).remove();
      tooltipRef.current = null;
    }
    applyHighlight(selectedFunction, depthLevel);
  }, [selectedFunction, depthLevel, applyHighlight]);

  // Update node metric text when preset changes
  useEffect(() => {
    if (!nodeSelectionRef.current) return;
    
    const getNodeFunctionData = (nodeId) => {
      return functionsWithMetricsRef.current.find(func => func.name === nodeId);
    };

    const getNodeDisplayText = (nodeId) => {
      const funcData = getNodeFunctionData(nodeId);
      const node = nodesDataRef.current.find(n => n.id === nodeId);
      if (!funcData) return `deg: ${node?.degree || 0}`;
      
      switch (selectedPreset) {
        case 'complexity':
          return `CC: ${funcData.complexity}`;
        case 'severity':
          return `H: ${funcData.severityCounts.High || 0}`;
        case 'easy':
          return `E: ${funcData.easyFixCount || 0}`;
        default:
          return `deg: ${funcData.degree || 0}`;
      }
    };

    nodeSelectionRef.current.selectAll('.metric-text')
      .text(d => getNodeDisplayText(d.id));
  }, [selectedPreset]);

  return (
    <div className="w-full h-full relative">
      <svg
        ref={svgRef}
        width="100%"
        height="100%"
        className="border border-gray-200 rounded-lg"
        style={{ minHeight: '500px' }}
      />
      
      {/* Depth Level Control - Prominent, top-right when function is selected */}
      {selectedFunction && (
        <div className="absolute top-4 right-4 bg-white rounded-lg shadow-lg border border-gray-200 p-4 z-10">
          <div className="flex items-center gap-3">
            <div>
              <label className="block text-sm font-semibold text-gray-900 mb-2">
                Depth Level
              </label>
              <select
                value={depthLevel}
                onChange={(e) => setDepthLevel(Number(e.target.value))}
                className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 focus:ring-2 focus:ring-primary focus:border-transparent transition-colors shadow-sm"
              >
                <option value={1}>1 Level (Direct)</option>
                <option value={2}>2 Levels</option>
                <option value={3}>3 Levels</option>
                <option value={4}>4 Levels</option>
                <option value={0}>All Levels</option>
              </select>
            </div>
            <div className="text-xs text-gray-600 pt-7">
              <div className="font-medium">Showing:</div>
              <div className="text-gray-500 mt-1">
                {depthLevel === 0 ? 'All connected functions' : `${depthLevel} level${depthLevel !== 1 ? 's' : ''} deep`}
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* Controls */}
      <div className="absolute top-4 left-4 bg-white rounded-lg shadow-lg p-3 space-y-2">
        <div className="text-sm font-medium text-gray-700">Graph Controls</div>
        <div className="text-xs text-gray-500 space-y-1">
          <div>• Drag nodes to move them</div>
          <div>• Scroll to zoom in/out</div>
          <div>• Click nodes for details</div>
          <div>• Hover to see connections</div>
        </div>
      </div>

      {/* Legend */}
      <div className="absolute bottom-4 right-4 bg-white rounded-lg shadow-lg p-3">
        <div className="text-sm font-medium text-gray-700 mb-2">Legend</div>
        <div className="space-y-1 text-xs">
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 rounded-full bg-blue-500"></div>
            <span>기본 노드</span>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 rounded-full bg-blue-300"></div>
            <span>연결된 노드</span>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 rounded-full bg-blue-600"></div>
            <span>선택된 노드</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CallGraph;
