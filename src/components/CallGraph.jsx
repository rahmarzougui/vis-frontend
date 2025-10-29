import React, { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import { mockData } from '../mockData';

const CallGraph = ({ selectedFunction = null, onNodeClick = null }) => {
  const svgRef = useRef();
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const updateDimensions = () => {
      if (svgRef.current) {
        const rect = svgRef.current.getBoundingClientRect();
        setDimensions({ width: rect.width, height: rect.height });
      }
    };

    updateDimensions();
    window.addEventListener('resize', updateDimensions);
    return () => window.removeEventListener('resize', updateDimensions);
  }, []);

  useEffect(() => {
    if (dimensions.width === 0 || dimensions.height === 0) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove(); // Clear previous graph

    const { nodes, edges } = mockData;
    
    // Create force simulation
    const simulation = d3.forceSimulation(nodes)
      .force("link", d3.forceLink(edges).id(d => d.id).distance(100))
      .force("charge", d3.forceManyBody().strength(-300))
      .force("center", d3.forceCenter(dimensions.width / 2, dimensions.height / 2))
      .force("collision", d3.forceCollide().radius(30));

    // Create container for zoom
    const container = svg.append("g");

    // Add zoom behavior
    const zoom = d3.zoom()
      .scaleExtent([0.1, 4])
      .on("zoom", (event) => {
        container.attr("transform", event.transform);
      });

    svg.call(zoom);

    // Create links
    const link = container.append("g")
      .attr("class", "links")
      .selectAll("line")
      .data(edges)
      .enter().append("line")
      .attr("stroke", "#999")
      .attr("stroke-opacity", 0.6)
      .attr("stroke-width", 2)
      .attr("marker-end", "url(#arrowhead)");

    // Create arrow markers
    svg.append("defs").append("marker")
      .attr("id", "arrowhead")
      .attr("viewBox", "-0 -5 10 10")
      .attr("refX", 25)
      .attr("refY", 0)
      .attr("orient", "auto")
      .append("path")
      .attr("d", "M 0,-5 L 10 ,0 L 0,5")
      .attr("fill", "#999");

    // Create nodes
    const node = container.append("g")
      .attr("class", "nodes")
      .selectAll("g")
      .data(nodes)
      .enter().append("g")
      .attr("class", "node")
      .style("cursor", "pointer")
      .call(d3.drag()
        .on("start", dragstarted)
        .on("drag", dragged)
        .on("end", dragended));

    // Add circles for nodes
    node.append("circle")
      .attr("r", d => Math.max(15, Math.min(25, d.degree * 2)))
      .attr("fill", d => {
        if (selectedFunction && d.id === selectedFunction) return "#ff6b6b";
        if (d.degree > 6) return "#4ecdc4";
        if (d.degree > 3) return "#45b7d1";
        return "#96ceb4";
      })
      .attr("stroke", d => {
        if (selectedFunction && d.id === selectedFunction) return "#ff5252";
        return "#fff";
      })
      .attr("stroke-width", 2);

    // Add labels
    node.append("text")
      .attr("dx", 0)
      .attr("dy", 5)
      .attr("text-anchor", "middle")
      .attr("font-size", "10px")
      .attr("font-weight", "bold")
      .attr("fill", "#333")
      .text(d => d.name.length > 8 ? d.name.substring(0, 8) + "..." : d.name);

    // Add degree labels
    node.append("text")
      .attr("dx", 0)
      .attr("dy", 18)
      .attr("text-anchor", "middle")
      .attr("font-size", "8px")
      .attr("fill", "#666")
      .text(d => `deg: ${d.degree}`);

    // Add hover effects
    node
      .on("mouseover", function(event, d) {
        // Highlight connected nodes
        const connectedNodes = new Set();
        edges.forEach(edge => {
          if (edge.source.id === d.id) connectedNodes.add(edge.target.id);
          if (edge.target.id === d.id) connectedNodes.add(edge.source.id);
        });

        node.select("circle")
          .attr("opacity", n => 
            n.id === d.id || connectedNodes.has(n.id) ? 1 : 0.3
          );

        link
          .attr("opacity", e => 
            e.source.id === d.id || e.target.id === d.id ? 1 : 0.1
          );

        // Show tooltip
        const tooltip = d3.select("body").append("div")
          .attr("class", "tooltip")
          .style("position", "absolute")
          .style("background", "rgba(0,0,0,0.8)")
          .style("color", "white")
          .style("padding", "8px")
          .style("border-radius", "4px")
          .style("font-size", "12px")
          .style("pointer-events", "none")
          .style("z-index", "1000");

        tooltip.html(`
          <strong>${d.name}</strong><br/>
          In-degree: ${d.in_degree}<br/>
          Out-degree: ${d.out_degree}<br/>
          Total degree: ${d.degree}
        `);
      })
      .on("mousemove", function(event) {
        d3.select(".tooltip")
          .style("left", (event.pageX + 10) + "px")
          .style("top", (event.pageY - 10) + "px");
      })
      .on("mouseout", function() {
        // Reset opacity
        node.select("circle").attr("opacity", 1);
        link.attr("opacity", 0.6);

        // Remove tooltip
        d3.select(".tooltip").remove();
      })
      .on("click", function(event, d) {
        if (onNodeClick) {
          onNodeClick(d);
        }
      });

    // Update positions on simulation tick
    simulation.on("tick", () => {
      link
        .attr("x1", d => d.source.x)
        .attr("y1", d => d.source.y)
        .attr("x2", d => d.target.x)
        .attr("y2", d => d.target.y);

      node
        .attr("transform", d => `translate(${d.x},${d.y})`);
    });

    // Drag functions
    function dragstarted(event, d) {
      if (!event.active) simulation.alphaTarget(0.3).restart();
      d.fx = d.x;
      d.fy = d.y;
    }

    function dragged(event, d) {
      d.fx = event.x;
      d.fy = event.y;
    }

    function dragended(event, d) {
      if (!event.active) simulation.alphaTarget(0);
      d.fx = null;
      d.fy = null;
    }

    // Cleanup function
    return () => {
      simulation.stop();
    };
  }, [dimensions, selectedFunction, onNodeClick]);

  return (
    <div className="w-full h-full relative">
      <svg
        ref={svgRef}
        width="100%"
        height="100%"
        className="border border-gray-200 rounded-lg"
        style={{ minHeight: '500px' }}
      />
      
      {/* Controls */}
      <div className="absolute top-4 left-4 bg-white rounded-lg shadow-lg p-3 space-y-2">
        <div className="text-sm font-medium text-gray-700">Graph Controls</div>
        <div className="text-xs text-gray-500">
          • Drag nodes to move them<br/>
          • Scroll to zoom in/out<br/>
          • Click nodes for details<br/>
          • Hover to see connections
        </div>
      </div>

      {/* Legend */}
      <div className="absolute bottom-4 right-4 bg-white rounded-lg shadow-lg p-3">
        <div className="text-sm font-medium text-gray-700 mb-2">Legend</div>
        <div className="space-y-1 text-xs">
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 rounded-full bg-red-400"></div>
            <span>Selected Function</span>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 rounded-full bg-teal-400"></div>
            <span>High Degree (6+)</span>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 rounded-full bg-blue-400"></div>
            <span>Medium Degree (3-6)</span>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 rounded-full bg-green-400"></div>
            <span>Low Degree (&lt;3)</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CallGraph;
