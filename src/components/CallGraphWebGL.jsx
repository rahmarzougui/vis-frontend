import { useEffect, useState, useRef } from 'react';
import ForceGraph from 'force-graph';
import { forceCollide } from 'd3-force';

// Helper function to generate cluster data from nodes grouped by file
const generateClusterData = (nodes, links) => {
  // Group nodes by file
  const fileGroups = {};
  nodes.forEach(node => {
    const file = node.file;
    if (!fileGroups[file]) {
      fileGroups[file] = [];
    }
    fileGroups[file].push(node);
  });

  // Create cluster nodes
  const clusterNodes = Object.entries(fileGroups).map(([file, members]) => {
    // Calculate centroid position (will be set by force simulation)
    const totalDegree = members.reduce((sum, n) => sum + n.degree, 0);
    const avgDegree = totalDegree / members.length;

    return {
      id: file,
      name: file.replace('src/', ''), // Display name without src/
      file: file,
      memberCount: members.length,
      members: members.map(m => m.id),
      degree: totalDegree,
      avgDegree: avgDegree,
      isCluster: true
    };
  });

  // Build cluster-to-cluster links
  const clusterLinks = new Map();
  links.forEach(link => {
    const sourceNode = nodes.find(n => n.id === (link.source.id || link.source));
    const targetNode = nodes.find(n => n.id === (link.target.id || link.target));

    if (sourceNode && targetNode) {
      const sourceFile = sourceNode.file;
      const targetFile = targetNode.file;

      // Only create links between different clusters
      if (sourceFile !== targetFile) {
        const linkKey = `${sourceFile}->${targetFile}`;
        if (!clusterLinks.has(linkKey)) {
          clusterLinks.set(linkKey, {
            source: sourceFile,
            target: targetFile,
            count: 0
          });
        }
        clusterLinks.get(linkKey).count++;
      }
    }
  });

  return {
    nodes: clusterNodes,
    links: Array.from(clusterLinks.values())
  };
};

const CallGraphWebGL = ({
  searchFunctionName = '',
  graphData = null,
  title = 'SQLite Call Graph',
  onToggleOverview,
  isOverviewOpen = false,
}) => {
  console.log('[Component] ===== CallGraphWebGL RENDER =====');

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [searchInput, setSearchInput] = useState(''); // User's typed input
  const [searchTerm, setSearchTerm] = useState(''); // Executed search term
  const [highlightNodes, setHighlightNodes] = useState(new Set());
  const [highlightLinks, setHighlightLinks] = useState(new Set());
  const [zoomLevel, setZoomLevel] = useState(1);
  const [viewMode, setViewMode] = useState('cluster'); // 'cluster' or 'detail' - start with cluster
  const [clusterData, setClusterData] = useState(null);
  const [rawData, setRawData] = useState(null); // Store original data for switching
  const [isTransitioning, setIsTransitioning] = useState(false); // Loading state for view transitions
  const [hoverNode, setHoverNode] = useState(null); // Currently hovered node
  const [isSubgraphMode, setIsSubgraphMode] = useState(false); // Track if showing subgraph
  const [subgraphData, setSubgraphData] = useState(null); // Store extracted subgraph
  const [isPanelOpen, setIsPanelOpen] = useState(false); // Toggle for SQLite Call Graph panel
  const [edgeFilterMode, setEdgeFilterMode] = useState('all'); // 'all' | 'incoming' | 'outgoing'
  const containerRef = useRef();
  const graphRef = useRef();
  const isUpdatingView = useRef(false); // Prevent loops during view updates
  const hasSetInitialZoom = useRef(false); // Track if initial zoom has been set
  const searchTermRef = useRef(''); // Ref for search term to use in canvas rendering
  const highlightNodesRef = useRef(new Set()); // Ref for highlighted nodes
  const highlightLinksRef = useRef(new Set()); // Ref for highlighted links
  const hoverInEdgesRef = useRef(new Set()); // Ref for incoming edges to hovered/searched node
  const hoverOutEdgesRef = useRef(new Set()); // Ref for outgoing edges from hovered/searched node
  // Refs for edge filter mode - store full subgraph data for filtering
  const subgraphMatchedIdsRef = useRef(new Set()); // IDs of matched (searched) nodes
  const subgraphInNeighborIdsRef = useRef(new Set()); // IDs of nodes that call matched nodes (sources of in-edges)
  const subgraphOutNeighborIdsRef = useRef(new Set()); // IDs of nodes called by matched nodes (targets of out-edges)
  const subgraphAllInEdgesRef = useRef(new Set()); // All incoming edge IDs
  const subgraphAllOutEdgesRef = useRef(new Set()); // All outgoing edge IDs
  const subgraphAllLinksRef = useRef([]); // All link objects in subgraph
  const edgeFilterModeRef = useRef('all'); // Ref for edge filter mode
  const viewModeRef = useRef('cluster'); // Ref to avoid stale closure in zoom handler
  const dataRef = useRef(null); // Ref to avoid stale closure in event handlers

  console.log('[Component] Current state - viewMode:', viewMode, 'zoomLevel:', zoomLevel.toFixed(3), 'isTransitioning:', isTransitioning, 'searchTerm:', searchTerm);
  console.log('[Component] Refs - isUpdatingView:', isUpdatingView.current, 'hasSetInitialZoom:', hasSetInitialZoom.current, 'viewModeRef:', viewModeRef.current);

  // Keep refs in sync with state to avoid stale closures
  viewModeRef.current = viewMode;
  dataRef.current = data;
  edgeFilterModeRef.current = edgeFilterMode;
  const pendingExternalSearchRef = useRef(null); // For coordinating external search with data load

  // Dual thresholds for hysteresis to prevent rapid toggling
  const ZOOM_THRESHOLD_ENTER_DETAIL = 1.6; // Zoom in to this level to enter detail view
  const ZOOM_THRESHOLD_EXIT_DETAIL = 0.8;  // Zoom out below this to exit detail view

  useEffect(() => {
    console.log('[Data Load] ===== STARTING DATA LOAD =====');

    const loadData = async () => {
      try {
        let source = graphData;
        if (!source) {
          const response = await fetch('/sqlite_cg.json');
          source = await response.json();
        }

        if (!source || !Array.isArray(source.nodes) || !Array.isArray(source.edges)) {
          throw new Error('Invalid call graph data format.');
        }

        console.log('[Data Load] JSON parsed, total nodes:', source.nodes.length, 'total edges:', source.edges.length);

        // Filter out nodes without file information (file === null)
        // Also filter out isolated nodes (degree === 0) as they create circular rings
        const filteredNodes = source.nodes.filter(node =>
          node.file !== null && node.degree > 0
        );

        console.log(`[Data Load] Filtered: ${source.nodes.length} -> ${filteredNodes.length} nodes (removed ${source.nodes.length - filteredNodes.length} nodes)`);

        // Filter edges to only include those between filtered nodes
        const nodeIds = new Set(filteredNodes.map(n => n.id));
        const filteredEdges = source.edges.filter(
          edge => nodeIds.has(edge.source) && nodeIds.has(edge.target)
        );

        console.log(`[Data Load] Filtered edges: ${source.edges.length} -> ${filteredEdges.length}`);

        // force-graph expects 'links' instead of 'edges'
        const graphDataObj = {
          nodes: filteredNodes,
          links: filteredEdges
        };

        console.log('[Data Load] Generating cluster data...');
        // Generate cluster data
        const clusters = generateClusterData(filteredNodes, filteredEdges);
        console.log('[Data Load] Clusters generated:', clusters.nodes.length, 'cluster nodes,', clusters.links.length, 'cluster links');

        setRawData(graphDataObj); // Store for detail view
        setClusterData(clusters); // Store for cluster view
        setData(clusters); // Start with cluster view
        setLoading(false);
        console.log('[Data Load] ===== DATA LOAD COMPLETE =====');
      } catch (error) {
        console.error('[Data Load] ERROR:', error);
        setLoading(false);
      }
    };

    loadData();
  }, [graphData]);

  // Handle search - now creates subgraph view
  useEffect(() => {
    console.log('[Search] Effect triggered - searchTerm:', searchTerm, 'rawData:', !!rawData, 'isSubgraphMode:', isSubgraphMode);

    // If search is cleared, restore full graph
    if (!searchTerm) {
      if (isSubgraphMode) {
        console.log('[Search] Clearing search - restoring full graph');
        setIsTransitioning(true);

        setTimeout(() => {
          // Restore cluster view and data
          setIsSubgraphMode(false);
          setSubgraphData(null);
          setHighlightNodes(new Set());
          setHighlightLinks(new Set());
          highlightNodesRef.current = new Set();
          highlightLinksRef.current = new Set();
          hoverInEdgesRef.current = new Set();
          hoverOutEdgesRef.current = new Set();
          searchTermRef.current = '';
          // Clear subgraph filter refs
          subgraphMatchedIdsRef.current = new Set();
          subgraphInNeighborIdsRef.current = new Set();
          subgraphOutNeighborIdsRef.current = new Set();
          subgraphAllInEdgesRef.current = new Set();
          subgraphAllOutEdgesRef.current = new Set();
          subgraphAllLinksRef.current = [];
          setEdgeFilterMode('all');

          // Switch back to cluster view and data
          if (graphRef.current && clusterData) {
            graphRef.current.graphData(clusterData);
            setData(clusterData);
            setViewMode('cluster');
            dataRef.current = clusterData;

            // Reset to default zoom
            setTimeout(() => {
              graphRef.current.zoom(1.0, 800);
              graphRef.current.centerAt(0, 0, 800);

              setTimeout(() => {
                setIsTransitioning(false);
              }, 1000);
            }, 100);
          }
        }, 50);
      }
      return;
    }

    if (!rawData || !graphRef.current) {
      console.log('[Search] No rawData or graph available');
      return;
    }

    console.log('[Search] Searching for:', searchTerm, 'in', rawData.nodes.length, 'nodes');
    const searchLower = searchTerm.toLowerCase().trim();

    if (!searchLower) {
      console.log('[Search] Empty search term');
      return;
    }

    // Search in function names - prioritize exact matches, then startsWith, then includes
    const exactMatches = rawData.nodes.filter(node =>
      node.name.toLowerCase() === searchLower
    );

    const startsWithMatches = rawData.nodes.filter(node =>
      node.name.toLowerCase().startsWith(searchLower) &&
      !exactMatches.includes(node)
    );

    const includesMatches = rawData.nodes.filter(node =>
      node.name.toLowerCase().includes(searchLower) &&
      !exactMatches.includes(node) &&
      !startsWithMatches.includes(node)
    );

    // Prioritize exact > startsWith > includes, limit to first 5 matches
    const matchedNodes = [...exactMatches, ...startsWithMatches, ...includesMatches].slice(0, 5);

    console.log('[Search] Matched nodes:', matchedNodes.length, '(exact:', exactMatches.length, 'starts:', startsWithMatches.length, 'includes:', includesMatches.length, ')');

    if (matchedNodes.length === 0) {
      console.log('[Search] No matches found');
      alert(`No functions found matching "${searchTerm}"`);
      return;
    }

    // Extract subgraph: matched nodes + 1-hop neighbors
    const matchedIds = new Set(matchedNodes.map(n => n.id));
    const neighborIds = new Set();
    const inNeighborIds = new Set(); // Nodes that CALL matched nodes (sources of incoming edges)
    const outNeighborIds = new Set(); // Nodes CALLED BY matched nodes (targets of outgoing edges)
    const linkData = []; // Store clean link data
    const inEdgeIds = new Set(); // Track in-edges by ID
    const outEdgeIds = new Set(); // Track out-edges by ID

    rawData.links.forEach(link => {
      const sourceId = link.source.id || link.source;
      const targetId = link.target.id || link.target;

      // If source is matched, add target as neighbor (outgoing edge)
      if (matchedIds.has(sourceId)) {
        neighborIds.add(targetId);
        outNeighborIds.add(targetId); // Track as out-neighbor
        linkData.push({ source: sourceId, target: targetId });
        outEdgeIds.add(`${sourceId}->${targetId}`);
      }
      // If target is matched, add source as neighbor (incoming edge)
      if (matchedIds.has(targetId)) {
        neighborIds.add(sourceId);
        inNeighborIds.add(sourceId); // Track as in-neighbor
        // Only add link if not already added (avoid duplicates)
        if (!matchedIds.has(sourceId)) {
          linkData.push({ source: sourceId, target: targetId });
        }
        inEdgeIds.add(`${sourceId}->${targetId}`);
      }
    });

    // Combine all node IDs
    const allNodeIds = new Set([...matchedIds, ...neighborIds]);

    // Create COMPLETELY NEW node objects with NO old data
    const subgraphNodes = [];
    rawData.nodes.forEach(node => {
      if (allNodeIds.has(node.id)) {
        // Create clean node object - only essential data
        subgraphNodes.push({
          id: node.id,
          name: node.name,
          file: node.file,
          degree: node.degree,
          in_degree: node.in_degree,
          out_degree: node.out_degree
          // NO x, y, vx, vy - let force graph initialize fresh
        });
      }
    });

    // Remove duplicate links
    const uniqueLinks = Array.from(
      new Set(linkData.map(l => `${l.source}|${l.target}`))
    ).map(key => {
      const [source, target] = key.split('|');
      return { source, target };
    });

    const newSubgraph = {
      nodes: subgraphNodes,
      links: uniqueLinks
    };

    console.log('[Search] Created subgraph:', subgraphNodes.length, 'nodes,', uniqueLinks.length, 'links');
    console.log('[Search] In-edges:', inEdgeIds.size, 'Out-edges:', outEdgeIds.size);
    console.log('[Search] In-neighbors:', inNeighborIds.size, 'Out-neighbors:', outNeighborIds.size);

    // Store full subgraph data in refs for edge filter mode
    subgraphMatchedIdsRef.current = matchedIds;
    subgraphInNeighborIdsRef.current = inNeighborIds;
    subgraphOutNeighborIdsRef.current = outNeighborIds;
    subgraphAllInEdgesRef.current = inEdgeIds;
    subgraphAllOutEdgesRef.current = outEdgeIds;
    subgraphAllLinksRef.current = uniqueLinks;

    // Reset edge filter mode to 'all' when entering subgraph
    setEdgeFilterMode('all');

    // Update highlight refs for color coding
    // IMPORTANT: Highlight ALL subgraph nodes so none are dimmed
    highlightNodesRef.current = allNodeIds; // Include matched + neighbors
    highlightLinksRef.current = new Set(uniqueLinks);
    hoverInEdgesRef.current = inEdgeIds; // Use ID-based sets
    hoverOutEdgesRef.current = outEdgeIds; // Use ID-based sets
    // Keep searchTerm for showing we're in subgraph mode, but all nodes are highlighted
    searchTermRef.current = searchTerm;

    // Show loading screen
    setIsTransitioning(true);

    setTimeout(() => {
      // Switch to subgraph mode
      setIsSubgraphMode(true);
      setSubgraphData(newSubgraph);
      setViewMode('detail'); // Always detail view for subgraph

      // Apply subgraph data to graph and let simulation run
      graphRef.current.graphData(newSubgraph);
      setData(newSubgraph);
      dataRef.current = newSubgraph;

      // Reheat simulation with stronger forces for tight clustering
      console.log('[Search] Running force simulation on subgraph...');
      graphRef.current.d3Force('charge').strength(-150);
      graphRef.current.d3Force('link').distance(30).strength(1.0);
      graphRef.current.d3ReheatSimulation();

      // Wait longer for simulation to settle and nodes to get positions
      setTimeout(() => {
        // Now center and fit after simulation has run
        const nodes = newSubgraph.nodes;

        // Check if nodes have positions
        if (nodes.length > 0 && nodes[0].x !== undefined) {
          const xs = nodes.map(n => n.x);
          const ys = nodes.map(n => n.y);
          const minX = Math.min(...xs);
          const maxX = Math.max(...xs);
          const minY = Math.min(...ys);
          const maxY = Math.max(...ys);

          const centerX = (minX + maxX) / 2;
          const centerY = (minY + maxY) / 2;

          const width = Math.max(maxX - minX, 100);
          const height = Math.max(maxY - minY, 100);
          const containerWidth = graphRef.current.width();
          const containerHeight = graphRef.current.height();

          const zoomFit = Math.min(containerWidth / width, containerHeight / height) * 0.8;
          const finalZoom = Math.min(Math.max(zoomFit, 0.8), 3.0); // Clamp zoom

          console.log('[Search] Centering at', centerX, centerY, 'with zoom', finalZoom);
          graphRef.current.centerAt(centerX, centerY, 1000);
          graphRef.current.zoom(finalZoom, 1000);
        } else {
          console.log('[Search] Nodes do not have positions yet, using default view');
          graphRef.current.centerAt(0, 0, 1000);
          graphRef.current.zoom(2.0, 1000);
        }

        // Hide loading after everything settles
        setTimeout(() => {
          setIsTransitioning(false);
        }, 1500);
      }, 3000); // Wait 3 seconds for simulation to settle
    }, 50);
  }, [searchTerm, rawData, clusterData, isSubgraphMode]);

  // Handle edge filter mode changes in subgraph mode
  useEffect(() => {
    console.log('[EdgeFilter] Effect triggered - edgeFilterMode:', edgeFilterMode, 'isSubgraphMode:', isSubgraphMode);

    // Only apply filter when in subgraph mode
    if (!isSubgraphMode) {
      console.log('[EdgeFilter] SKIP - not in subgraph mode');
      return;
    }

    if (!graphRef.current) {
      console.log('[EdgeFilter] SKIP - no graph ref');
      return;
    }

    const matchedIds = subgraphMatchedIdsRef.current;
    const inNeighborIds = subgraphInNeighborIdsRef.current;
    const outNeighborIds = subgraphOutNeighborIdsRef.current;
    const allInEdges = subgraphAllInEdgesRef.current;
    const allOutEdges = subgraphAllOutEdgesRef.current;
    const allLinks = subgraphAllLinksRef.current;

    if (matchedIds.size === 0) {
      console.log('[EdgeFilter] SKIP - no matched IDs in refs');
      return;
    }

    console.log('[EdgeFilter] Applying filter:', edgeFilterMode);
    console.log('[EdgeFilter] Matched:', matchedIds.size, 'InNeighbors:', inNeighborIds.size, 'OutNeighbors:', outNeighborIds.size);

    let filteredNodeIds;
    let filteredInEdges;
    let filteredOutEdges;

    switch (edgeFilterMode) {
      case 'incoming':
        // Show matched nodes + nodes that CALL matched (in-neighbors)
        filteredNodeIds = new Set([...matchedIds, ...inNeighborIds]);
        filteredInEdges = allInEdges;
        filteredOutEdges = new Set(); // Hide outgoing edges
        break;
      case 'outgoing':
        // Show matched nodes + nodes CALLED BY matched (out-neighbors)
        filteredNodeIds = new Set([...matchedIds, ...outNeighborIds]);
        filteredInEdges = new Set(); // Hide incoming edges
        filteredOutEdges = allOutEdges;
        break;
      case 'all':
      default:
        // Show all: matched + in-neighbors + out-neighbors
        filteredNodeIds = new Set([...matchedIds, ...inNeighborIds, ...outNeighborIds]);
        filteredInEdges = allInEdges;
        filteredOutEdges = allOutEdges;
        break;
    }

    // Filter links based on edge filter mode
    const filteredLinks = allLinks.filter(link => {
      const sourceId = link.source.id || link.source;
      const targetId = link.target.id || link.target;
      const linkId = `${sourceId}->${targetId}`;

      // Keep link if it's in the filtered in-edges or out-edges
      return filteredInEdges.has(linkId) || filteredOutEdges.has(linkId);
    });

    console.log('[EdgeFilter] Filtered nodes:', filteredNodeIds.size, 'Filtered links:', filteredLinks.length);

    // Update highlight refs for rendering
    highlightNodesRef.current = filteredNodeIds;
    highlightLinksRef.current = new Set(filteredLinks);
    hoverInEdgesRef.current = filteredInEdges;
    hoverOutEdgesRef.current = filteredOutEdges;

    // Trigger redraw
    graphRef.current.nodeRelSize(graphRef.current.nodeRelSize());
  }, [edgeFilterMode, isSubgraphMode]);

  useEffect(() => {
    console.log('[Graph Init] Effect triggered - data:', !!data, 'container:', !!containerRef.current, 'graphRef:', !!graphRef.current);

    if (!data || !containerRef.current || graphRef.current) {
      console.log('[Graph Init] SKIP - conditions not met');
      return; // Only create graph once
    }

    console.log('[Graph Init] ===== INITIALIZING GRAPH =====');
    console.log('[Graph Init] Data has', data.nodes.length, 'nodes and', data.links.length, 'links');

    // Get max degree for color scaling
    const maxDegree = Math.max(...data.nodes.map(n => n.degree));
    console.log('[Graph Init] Max degree:', maxDegree);

    console.log('[Graph Init] Creating ForceGraph instance...');

    // Get container dimensions
    const width = containerRef.current.clientWidth;
    const height = containerRef.current.clientHeight;
    console.log('[Graph Init] Container dimensions:', width, 'x', height);

    // Create the graph with explicit dimensions for high-DPI displays
    const graph = ForceGraph()(containerRef.current)
      .width(width)
      .height(height)
      .graphData(data)
      .nodeId('id')
      .nodeLabel(node => {
        if (node.isCluster) {
          return `${node.name}\n${node.memberCount} functions\nTotal degree: ${node.degree}\nAvg degree: ${node.avgDegree.toFixed(1)}`;
        }
        return `${node.name}\nFile: ${node.file}\nDegree: ${node.degree}\nIn: ${node.in_degree}, Out: ${node.out_degree}`;
      })
      .nodeVal(node => node.isCluster ? Math.sqrt(node.memberCount) * 3 : Math.sqrt(node.degree) * 3 + 1)
      .nodeColor(node => {
        // Color based on degree - using a gradient from light to dark blue
        const ratio = node.degree / maxDegree;
        const r = Math.floor(100 + (0 - 100) * ratio);
        const g = Math.floor(150 + (80 - 150) * ratio);
        const b = Math.floor(255 + (200 - 255) * ratio);
        return `rgb(${r}, ${g}, ${b})`;
      })
      .nodeCanvasObjectMode(() => 'replace')
      .nodeCanvasObject((node, ctx, globalScale) => {
        const isCluster = node.isCluster;
        const isHighlighted = highlightNodesRef.current.has(node.id);
        const hasSearch = searchTermRef.current && searchTermRef.current.length > 0;
        const hasHover = (hoverInEdgesRef.current.size > 0 || hoverOutEdgesRef.current.size > 0);
        const shouldDim = (hasSearch || hasHover) && !isHighlighted;

        // Helper function to truncate text with ellipsis
        const truncateText = (text, maxChars) => {
          if (text.length <= maxChars) return text;
          return text.substring(0, maxChars - 3) + '...';
        };

        // Helper function to draw text with stroke for better readability
        const drawTextWithStroke = (text, x, y, fillColor, strokeColor, strokeWidth) => {
          ctx.strokeStyle = strokeColor;
          ctx.lineWidth = strokeWidth;
          ctx.strokeText(text, x, y);
          ctx.fillStyle = fillColor;
          ctx.fillText(text, x, y);
        };

        if (isCluster) {
          // CLUSTER NODE RENDERING
          const clusterRadius = Math.sqrt(node.memberCount) * 4 + 12;

          // Draw cluster circle
          ctx.beginPath();
          ctx.arc(node.x, node.y, clusterRadius, 0, 2 * Math.PI);

          // Color based on average degree
          const ratio = Math.min(node.avgDegree / 50, 1);
          const r = Math.floor(80 + (20 - 80) * ratio);
          const g = Math.floor(120 + (200 - 120) * ratio);
          const b = Math.floor(200 + (80 - 200) * ratio);

          // Enhanced glow for highlighted clusters (but keep blue color)
          if (isHighlighted && (hasSearch || hasHover)) {
            ctx.shadowBlur = 25;
            ctx.shadowColor = `rgb(${r}, ${g}, ${b})`;
          }

          // Apply dimming for non-highlighted nodes during search or hover
          if (shouldDim) {
            ctx.fillStyle = `rgba(${r}, ${g}, ${b}, 0.03)`;
          } else if (isHighlighted) {
            ctx.fillStyle = `rgba(${r}, ${g}, ${b}, 1.0)`; // Full opacity, original color
          } else {
            ctx.fillStyle = `rgba(${r}, ${g}, ${b}, 0.8)`;
          }

          ctx.fill();
          ctx.strokeStyle = shouldDim ? 'rgba(255, 255, 255, 0.02)' : (isHighlighted ? 'rgba(255, 255, 255, 1.0)' : '#fff');
          ctx.lineWidth = isHighlighted ? 4 : 2;
          ctx.stroke();

          ctx.shadowBlur = 0;

          // Draw file name and member count (always show in cluster view unless dimmed)
          const showLabel = !shouldDim;

          if (showLabel) {
            // Smaller font size for cluster labels
            const fontSize = Math.max(12 / globalScale, 9);
            ctx.font = `bold ${fontSize}px Sans-Serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';

            // Truncate long file names based on zoom level
            const maxChars = Math.floor(15 + globalScale * 20); // More chars when zoomed in
            const displayName = truncateText(node.name, maxChars);

            // Draw background box with rounded corners for label
            const textWidth = ctx.measureText(displayName).width;
            const padding = fontSize * 0.5;
            const boxWidth = textWidth + padding * 2;
            const boxHeight = fontSize + padding;
            const cornerRadius = 4;

            // Background box
            ctx.fillStyle = isHighlighted ? 'rgba(50, 100, 200, 0.85)' : 'rgba(0, 0, 0, 0.75)';
            ctx.beginPath();
            ctx.roundRect(
              node.x - boxWidth / 2,
              node.y - boxHeight / 2 - 5,
              boxWidth,
              boxHeight,
              cornerRadius
            );
            ctx.fill();

            // File name with text stroke for contrast
            drawTextWithStroke(displayName, node.x, node.y - 3, 'white', 'rgba(0, 0, 0, 0.8)', 3);

            // Member count badge (always visible in cluster view)
            const countText = `${node.memberCount}`;
            ctx.font = `bold ${fontSize * 0.6}px Sans-Serif`;
            const badgeRadius = fontSize * 0.6;
            ctx.fillStyle = 'rgba(255, 100, 100, 0.9)';
            ctx.beginPath();
            ctx.arc(node.x + clusterRadius - badgeRadius, node.y - clusterRadius + badgeRadius, badgeRadius, 0, 2 * Math.PI);
            ctx.fill();
            ctx.fillStyle = 'white';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(countText, node.x + clusterRadius - badgeRadius, node.y - clusterRadius + badgeRadius);
          }

        } else {
          // INDIVIDUAL NODE RENDERING
          const nodeRadius = Math.sqrt(node.degree) * 3 + 6;
          const ratio = node.degree / maxDegree;
          const r = Math.floor(100 + (0 - 100) * ratio);
          const g = Math.floor(150 + (80 - 150) * ratio);
          const b = Math.floor(255 + (200 - 255) * ratio);

          ctx.beginPath();
          ctx.arc(node.x, node.y, nodeRadius, 0, 2 * Math.PI);

          // Enhanced highlight for search results or hover with proper dimming (keep blue color)
          if (isHighlighted && (hasSearch || hasHover)) {
            ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
            ctx.shadowBlur = 25;
            ctx.shadowColor = `rgb(${r}, ${g}, ${b})`;
          } else if (shouldDim) {
            // Heavily dimmed for non-highlighted during search or hover
            ctx.fillStyle = `rgba(${r}, ${g}, ${b}, 0.03)`;
            ctx.shadowBlur = 0;
          } else {
            ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
            ctx.shadowBlur = 0;
          }

          ctx.fill();
          ctx.strokeStyle = shouldDim ? 'rgba(255, 255, 255, 0.02)' : ((isHighlighted && (hasSearch || hasHover)) ? 'rgba(255, 255, 255, 1.0)' : '#fff');
          ctx.lineWidth = (isHighlighted && (hasSearch || hasHover)) ? 3 : 1.5;
          ctx.stroke();
          ctx.shadowBlur = 0;

          // Adaptive label display: show more labels as user zooms in or for important nodes
          // Always show labels for highlighted nodes
          const shouldShowLabel = isHighlighted || (globalScale > 1.2 && node.degree > 2) || globalScale > 2.0;
          const showNodeLabel = shouldShowLabel && !shouldDim;

          if (showNodeLabel) {
            // Smaller font size for detail view labels
            const fontSize = Math.max(11 / globalScale, 8);
            ctx.font = `bold ${fontSize}px Sans-Serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';

            // Truncate long function names based on zoom and importance
            let maxChars = Math.floor(12 + globalScale * 15); // More chars when zoomed in
            if (isHighlighted) maxChars = Math.floor(maxChars * 1.5); // Show more for highlighted
            const label = truncateText(node.name, maxChars);

            // Measure text for background box
            const textWidth = ctx.measureText(label).width;
            const padding = fontSize * 0.6;
            const boxWidth = textWidth + padding * 2;
            const boxHeight = fontSize + padding * 1.2;
            const cornerRadius = 6;
            const boxY = node.y + nodeRadius + 4;

            // Draw rounded background box with shadow
            ctx.shadowBlur = 8;
            ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
            ctx.fillStyle = isHighlighted ? 'rgba(50, 120, 220, 0.9)' : 'rgba(20, 20, 20, 0.85)';
            ctx.beginPath();
            ctx.roundRect(
              node.x - boxWidth / 2,
              boxY,
              boxWidth,
              boxHeight,
              cornerRadius
            );
            ctx.fill();
            ctx.shadowBlur = 0;

            // Add subtle border for highlighted labels
            if (isHighlighted) {
              ctx.strokeStyle = 'rgba(100, 180, 255, 0.8)';
              ctx.lineWidth = 2;
              ctx.stroke();
            }

            // Draw text with stroke for maximum readability
            drawTextWithStroke(
              label,
              node.x,
              boxY + boxHeight / 2,
              'white',
              'rgba(0, 0, 0, 0.9)',
              3
            );

            // Optional: Show degree badge for high-degree nodes
            if (node.degree > 10 && globalScale > 1.5) {
              const badgeText = `${node.degree}`;
              ctx.font = `bold ${fontSize * 0.5}px Sans-Serif`;
              const badgeSize = fontSize * 0.5;
              ctx.fillStyle = 'rgba(255, 150, 50, 0.9)';
              ctx.beginPath();
              ctx.arc(node.x + nodeRadius - badgeSize, node.y - nodeRadius + badgeSize, badgeSize, 0, 2 * Math.PI);
              ctx.fill();
              ctx.fillStyle = 'white';
              ctx.textAlign = 'center';
              ctx.textBaseline = 'middle';
              ctx.fillText(badgeText, node.x + nodeRadius - badgeSize, node.y - nodeRadius + badgeSize);
            }
          }
        }
      })
      .linkColor(link => {
        const hasSearch = searchTermRef.current && searchTermRef.current.length > 0;
        const hasHover = (hoverInEdgesRef.current.size > 0 || hoverOutEdgesRef.current.size > 0);

        // Get link ID for checking in/out edges
        const sourceId = link.source.id || link.source;
        const targetId = link.target.id || link.target;
        const linkId = `${sourceId}->${targetId}`;

        const isInEdge = hoverInEdgesRef.current.has(linkId);
        const isOutEdge = hoverOutEdgesRef.current.has(linkId);
        const isHighlighted = highlightLinksRef.current.has(link);

        // Debug logging for first few links when hover is active
        if (hasHover && (isInEdge || isOutEdge)) {
          console.log('[linkColor] Link:', linkId, 'isInEdge:', isInEdge, 'isOutEdge:', isOutEdge);
        }

        // Differentiate in-edges and out-edges with different colors
        if (isInEdge) {
          return 'rgba(100, 255, 100, 0.8)'; // Green for incoming edges
        } else if (isOutEdge) {
          return 'rgba(255, 150, 100, 0.8)'; // Orange for outgoing edges
        } else if (isHighlighted) {
          return 'rgba(100, 150, 255, 0.8)'; // Bright blue for general highlighted (search)
        } else if (hasSearch || hasHover) {
          return 'rgba(150, 150, 150, 0.05)'; // Very faded for non-highlighted during search or hover
        } else {
          return 'rgba(150, 150, 150, 0.5)'; // Normal opacity
        }
      })
      .linkWidth(link => highlightLinksRef.current.has(link) ? 3 : 1)
      .linkDirectionalArrowLength(link => {
        const isHighlighted = highlightLinksRef.current.has(link);
        const hasSearch = searchTermRef.current && searchTermRef.current.length > 0;
        const hasHover = (hoverInEdgesRef.current.size > 0 || hoverOutEdgesRef.current.size > 0);
        if ((hasSearch || hasHover) && !isHighlighted) return 0; // Hide arrows on dimmed links
        // Store arrow length on link for use in relPos calculation
        const arrowLength = isHighlighted ? 12 : 10;
        link.__arrowLength = arrowLength;
        return arrowLength;
      })
      .linkDirectionalArrowRelPos(link => {
        // Position arrow at the edge of the target node circle
        const target = typeof link.target === 'object' ? link.target : null;
        const source = typeof link.source === 'object' ? link.source : null;

        if (!target || !source || !target.x || !source.x) return 1; // Fallback

        // Calculate target node radius (exactly as in nodeCanvasObject)
        const targetRadius = target.isCluster
          ? Math.sqrt(target.memberCount) * 4 + 12
          : Math.sqrt(target.degree) * 3 + 6;

        // Get link distance (Euclidean distance between nodes)
        const dx = target.x - source.x;
        const dy = target.y - source.y;
        const linkLength = Math.sqrt(dx * dx + dy * dy);

        if (linkLength === 0 || linkLength <= targetRadius) return 0.5; // Avoid issues

        // Position arrow exactly at the circle's edge
        // relPos = 1 means target center, so subtract radius proportion
        const relativePosition = 1 - (targetRadius / linkLength);

        return relativePosition;
      })
      .linkDirectionalArrowColor(link => {
        const hasSearch = searchTermRef.current && searchTermRef.current.length > 0;
        const hasHover = (hoverInEdgesRef.current.size > 0 || hoverOutEdgesRef.current.size > 0);

        // Get link ID for checking in/out edges
        const sourceId = link.source.id || link.source;
        const targetId = link.target.id || link.target;
        const linkId = `${sourceId}->${targetId}`;

        const isInEdge = hoverInEdgesRef.current.has(linkId);
        const isOutEdge = hoverOutEdgesRef.current.has(linkId);
        const isHighlighted = highlightLinksRef.current.has(link);

        // Match arrow color to edge color
        if (isInEdge) {
          return 'rgba(100, 255, 100, 0.9)'; // Green for incoming edges
        } else if (isOutEdge) {
          return 'rgba(255, 150, 100, 0.9)'; // Orange for outgoing edges
        } else if (isHighlighted) {
          return 'rgba(100, 150, 255, 0.9)'; // Bright blue for highlighted
        } else if (hasSearch || hasHover) {
          return 'rgba(180, 180, 180, 0.05)'; // Very faded
        } else {
          return 'rgba(180, 180, 180, 0.7)'; // Normal
        }
      })
      .backgroundColor('#1a1a1a')
      .enableNodeDrag(true)
      .enableZoomInteraction(true)
      .enablePanInteraction(true)
      .minZoom(0.1)
      .maxZoom(3.5) // Limit maximum zoom to 3.5x
      .cooldownTicks(200) // More time to settle
      .d3AlphaDecay(0.03) // Slower energy dissipation for gradual settling
      .d3VelocityDecay(0.85) // High friction but allows more movement
      .d3AlphaMin(0.001) // Lower threshold before stopping simulation
      .warmupTicks(100) // Initial layout time
      .onZoom(({ k }) => {
        console.log('[Zoom] ===== ZOOM EVENT ===== level:', k.toFixed(3), 'hasSetInitialZoom:', hasSetInitialZoom.current);
        setZoomLevel(k);

        // Don't allow mode changes until initial setup is complete
        if (!hasSetInitialZoom.current) {
          console.log('[Zoom] SKIPPED - waiting for initial zoom setup to complete');
          return;
        }

        // Don't check mode during programmatic updates or transitions
        if (isUpdatingView.current) {
          console.log('[Zoom] SKIPPED - guard active, isUpdatingView:', isUpdatingView.current);
          return;
        }

        // Don't switch views in subgraph mode
        if (isSubgraphMode) {
          console.log('[Zoom] SKIPPED - in subgraph mode, view switching disabled');
          return;
        }

        // Hysteresis: use different thresholds based on current mode to prevent rapid toggling
        // USE REF to avoid stale closure!
        const currentMode = viewModeRef.current;
        let newMode = currentMode;
        if (currentMode === 'cluster' && k >= ZOOM_THRESHOLD_ENTER_DETAIL) {
          newMode = 'detail';
          console.log('[Zoom] TRIGGER: Entering detail view at', k.toFixed(3));
        } else if (currentMode === 'detail' && k < ZOOM_THRESHOLD_EXIT_DETAIL) {
          newMode = 'cluster';
          console.log('[Zoom] TRIGGER: Exiting to cluster view at', k.toFixed(3));
        }

        console.log('[Zoom] Current mode:', currentMode, '| New mode:', newMode, '| Thresholds: enter=' + ZOOM_THRESHOLD_ENTER_DETAIL + ', exit=' + ZOOM_THRESHOLD_EXIT_DETAIL);

        if (newMode !== currentMode) {
          console.log('[Zoom] *** MODE CHANGE INITIATED *** from', currentMode, 'to', newMode);

          // Temporarily prevent further zoom checks during mode switch
          isUpdatingView.current = true;
          console.log('[Zoom] Setting guard: isUpdatingView = true');
          setViewMode(newMode);

          // Release guard after a short delay to allow view switch to complete
          setTimeout(() => {
            isUpdatingView.current = false;
            console.log('[Zoom] Guard released: isUpdatingView = false');
          }, 100);
        } else {
          console.log('[Zoom] No mode change needed');
        }
      })
      .onNodeClick((node) => {
        const currentMode = viewModeRef.current;
        console.log('[NodeClick] Node clicked:', node.id, 'viewMode:', currentMode, 'isCluster:', node.isCluster);
        if (node.isCluster && currentMode === 'cluster') {
          // Zoom in to show details when clicking a cluster
          console.log('[NodeClick] Zooming in to cluster details - showing loading screen');
          isUpdatingView.current = true;
          setIsTransitioning(true); // Show loading screen
          graph.zoom(ZOOM_THRESHOLD_ENTER_DETAIL + 0.5, 800); // Zoom to 2.1x
          graph.centerAt(node.x, node.y, 800);

          // Keep loading screen visible while nodes settle (6 seconds)
          setTimeout(() => {
            isUpdatingView.current = false;
            setIsTransitioning(false);
            console.log('[NodeClick] Settling complete - hiding loading screen');
          }, 6000);
        }
      })
      .onNodeHover((node) => {
        // Only apply hover highlighting in detail view (no hover in cluster view)
        const currentMode = viewModeRef.current;
        const currentData = dataRef.current; // Use ref to get current data
        const hasSearch = searchTermRef.current && searchTermRef.current.length > 0;

        console.log('[NodeHover] ===== HOVER EVENT =====');
        console.log('[NodeHover] Node:', node?.id, 'name:', node?.name);
        console.log('[NodeHover] viewMode:', currentMode, 'hasSearch:', hasSearch);
        console.log('[NodeHover] data available:', !!currentData, 'links count:', currentData?.links?.length);

        // Don't override search highlighting
        if (hasSearch) {
          console.log('[NodeHover] SKIP - search is active');
          return;
        }

        if (currentMode !== 'detail') {
          console.log('[NodeHover] SKIP - not in detail view (current:', currentMode, ')');
          return;
        }

        if (!currentData) {
          console.log('[NodeHover] SKIP - no data available');
          return;
        }

        setHoverNode(node);

        if (!node) {
          // Clear hover highlighting
          console.log('[NodeHover] Clearing hover highlights (no node)');
          hoverInEdgesRef.current = new Set();
          hoverOutEdgesRef.current = new Set();
          highlightNodesRef.current = new Set();
          highlightLinksRef.current = new Set();
          console.log('[NodeHover] Refs cleared - triggering redraw');
          // Trigger redraw
          graph.nodeRelSize(graph.nodeRelSize());
          return;
        }

        // Find in-edges and out-edges for the hovered node
        const inEdgeIds = new Set(); // Use string IDs instead of link objects
        const outEdgeIds = new Set(); // Use string IDs instead of link objects
        const neighborIds = new Set();
        const highlightLinkObjects = new Set(); // Track link objects for highlightLinks

        console.log('[NodeHover] Searching through', currentData.links.length, 'links for node:', node.id);

        currentData.links.forEach(link => {
          const sourceId = link.source.id || link.source;
          const targetId = link.target.id || link.target;
          const linkId = `${sourceId}->${targetId}`;

          // Out-edge: hovered node is the source
          if (sourceId === node.id) {
            console.log('[NodeHover] Found OUT-edge:', linkId);
            outEdgeIds.add(linkId); // Store as string ID
            highlightLinkObjects.add(link);
            neighborIds.add(targetId);
          }

          // In-edge: hovered node is the target
          if (targetId === node.id) {
            console.log('[NodeHover] Found IN-edge:', linkId);
            inEdgeIds.add(linkId); // Store as string ID
            highlightLinkObjects.add(link);
            neighborIds.add(sourceId);
          }
        });

        console.log('[NodeHover] *** RESULTS ***');
        console.log('[NodeHover] In-edges:', inEdgeIds.size);
        console.log('[NodeHover] Out-edges:', outEdgeIds.size);
        console.log('[NodeHover] Neighbors:', neighborIds.size);

        // Update refs for rendering - use string IDs for in/out edge tracking
        hoverInEdgesRef.current = inEdgeIds;
        hoverOutEdgesRef.current = outEdgeIds;
        highlightNodesRef.current = new Set([node.id, ...neighborIds]);
        highlightLinksRef.current = highlightLinkObjects;

        console.log('[NodeHover] Refs updated:');
        console.log('[NodeHover]   hoverInEdgesRef.current.size:', hoverInEdgesRef.current.size);
        console.log('[NodeHover]   hoverOutEdgesRef.current.size:', hoverOutEdgesRef.current.size);
        console.log('[NodeHover]   highlightNodesRef.current.size:', highlightNodesRef.current.size);
        console.log('[NodeHover]   highlightLinksRef.current.size:', highlightLinksRef.current.size);

        // Trigger redraw
        console.log('[NodeHover] Triggering redraw...');
        graph.nodeRelSize(graph.nodeRelSize());
        console.log('[NodeHover] ===== END HOVER EVENT =====');
      })
      .onNodeDrag(node => {
        // Reheat simulation when dragging to allow movement
        console.log('[NodeDrag] Dragging node:', node.id, '- reheating simulation');
        graph.d3ReheatSimulation();
      })
      .onNodeDragEnd(node => {
        console.log('[NodeDragEnd] Drag ended for node:', node.id, '- fixing position');
        node.fx = node.x;
        node.fy = node.y;
        // Simulation will cool down naturally with alpha decay
        console.log('[NodeDragEnd] Letting simulation cool down naturally');
      })
      .onEngineStop(() => {
        console.log('[EngineStop] Simulation engine stopped - nodes have settled');
        // Only set initial zoom once on first load
        if (!hasSetInitialZoom.current) {
          console.log('[EngineStop] Initial load detected - setting initial zoom');
          hasSetInitialZoom.current = true;
          isUpdatingView.current = true;
          graph.zoom(1.0, 300); // Start at 1.0x for better initial clarity
          graph.centerAt(0, 0, 300);
          setTimeout(() => {
            isUpdatingView.current = false;
            setViewMode('cluster');
            setZoomLevel(1.0);
            console.log('[EngineStop] Initial setup complete');
          }, 100);
        }
      });

    graphRef.current = graph;
    console.log('[Graph Init] Graph instance saved to ref');

    // Adjust D3 forces for initial cluster view - gentle and stable
    console.log('[Graph Init] Configuring D3 forces for initial CLUSTER view...');
    graph.d3Force('charge').strength(-60); // Stronger repulsion for more space
    graph.d3Force('link').distance(100).strength(0.25); // Longer, weaker links
    graph.d3Force('center').strength(0.02); // Less centering for more spread

    // Collision detection - initial settings for cluster view
    graph.d3Force('collision', forceCollide()
      .radius(d => {
        // Use isCluster check for dynamic switching
        if (d.isCluster) {
          return Math.sqrt(d.memberCount) * 8 + 40; // Larger collision radius
        } else {
          return Math.sqrt(d.degree) * 12 + 40; // Match detail view spacing
        }
      })
      .strength(0.5) // Higher collision strength for better spacing
      .iterations(1));

    console.log('[Graph Init] ===== GRAPH INITIALIZATION COMPLETE =====');
  }, [data]); // Only run when data first becomes available

  // Cleanup on unmount only
  useEffect(() => {
    console.log('[Cleanup] Setting up cleanup handler');
    return () => {
      console.log('[Cleanup] Component unmounting - destroying graph');
      if (graphRef.current) {
        graphRef.current._destructor();
      }
    };
  }, []);

  // Handle window resize and container resize for high-DPI displays
  useEffect(() => {
    if (!graphRef.current || !containerRef.current) return;

    const handleResize = () => {
      const width = containerRef.current.clientWidth;
      const height = containerRef.current.clientHeight;
      console.log('[Resize] Updating canvas dimensions:', width, 'x', height, 'devicePixelRatio:', window.devicePixelRatio);
      graphRef.current.width(width).height(height);
      // Force a redraw to ensure canvas updates properly
      graphRef.current.nodeRelSize(graphRef.current.nodeRelSize());
    };

    // Initial call
    handleResize();

    // Add window resize listener
    window.addEventListener('resize', handleResize);

    // Add ResizeObserver to detect container size changes (e.g., when overview panel opens/closes)
    let resizeObserver;
    if (typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(entries => {
        for (const entry of entries) {
          if (entry.target === containerRef.current) {
            // Use requestAnimationFrame to debounce rapid resize events
            requestAnimationFrame(() => {
              handleResize();
            });
          }
        }
      });
      resizeObserver.observe(containerRef.current);
    }

    return () => {
      window.removeEventListener('resize', handleResize);
      if (resizeObserver) {
        resizeObserver.disconnect();
      }
    };
  }, [graphRef.current, containerRef.current]);

  // Trigger a redraw when highlights or search changes
  useEffect(() => {
    console.log('[Redraw] Highlight/search changed - triggering redraw');
    console.log('[Redraw] highlightNodes:', highlightNodes.size, 'highlightLinks:', highlightLinks.size, 'searchTerm:', searchTerm);

    if (graphRef.current) {
      // Force graph to re-render by updating a dummy property
      // This triggers the canvas to redraw with updated ref values
      graphRef.current.nodeRelSize(graphRef.current.nodeRelSize());
      console.log('[Redraw] Redraw triggered');
    }
  }, [highlightNodes, highlightLinks, searchTerm]);

  // Switch between cluster and detail view based on viewMode
  useEffect(() => {
    console.log('[ViewSwitch Effect] ===== TRIGGERED ===== viewMode:', viewMode, 'isSubgraphMode:', isSubgraphMode);
    console.log('[ViewSwitch Effect] graphRef:', !!graphRef.current, 'rawData:', !!rawData, 'clusterData:', !!clusterData, 'data:', !!data);

    // Don't switch views in subgraph mode
    if (isSubgraphMode) {
      console.log('[ViewSwitch Effect] ABORT - in subgraph mode, view switching disabled');
      return;
    }

    if (!graphRef.current) {
      console.log('[ViewSwitch Effect] ABORT - graphRef is NULL');
      return;
    }
    if (!rawData) {
      console.log('[ViewSwitch Effect] ABORT - rawData is NULL');
      return;
    }
    if (!clusterData) {
      console.log('[ViewSwitch Effect] ABORT - clusterData is NULL');
      return;
    }

    const targetData = viewMode === 'cluster' ? clusterData : rawData;
    console.log('[ViewSwitch Effect] Current data nodes:', data?.nodes.length);
    console.log('[ViewSwitch Effect] Target data nodes:', targetData?.nodes.length);
    console.log('[ViewSwitch Effect] Data same?', data === targetData);

    // Only update if data is actually different
    if (data !== targetData) {
      console.log('[ViewSwitch Effect] *** SWITCHING TO:', viewMode, '***');

      // Show loading indicator
      console.log('[ViewSwitch Effect] Setting isTransitioning = true');
      setIsTransitioning(true);

      // Temporarily block zoom events during switch
      isUpdatingView.current = true;
      console.log('[ViewSwitch Effect] Setting guard: isUpdatingView = true');

      // Small delay to allow loading indicator to show
      setTimeout(() => {
        console.log('[ViewSwitch Effect] Applying new graph data...');
        // Update graph data
        graphRef.current.graphData(targetData);
        setData(targetData);

        // Adjust forces based on view mode for proper spacing
        if (viewMode === 'detail') {
          console.log('[ViewSwitch Effect] Configuring forces for DETAIL view (high density)');
          graphRef.current.d3Force('charge').strength(-120); // Stronger repulsion for more space
          graphRef.current.d3Force('link')
            .distance(link => {
              // Connected nodes should be very close together
              return 15; // Extremely short distance for tight clustering
            })
            .strength(1.2); // Even stronger links to pull connected nodes together
          graphRef.current.d3Force('center').strength(0.005); // Very minimal centering
          graphRef.current.d3Force('collision', forceCollide()
            .radius(d => Math.sqrt(d.degree) * 12 + 40) // Much larger collision radius
            .strength(0.6) // Moderate strength for good spacing
            .iterations(1)); // Single iteration for stability
        } else {
          console.log('[ViewSwitch Effect] Configuring forces for CLUSTER view');
          graphRef.current.d3Force('charge').strength(-60); // Stronger repulsion for more space
          graphRef.current.d3Force('link').distance(100).strength(0.25); // Longer, weaker links
          graphRef.current.d3Force('center').strength(0.02); // Less centering for more spread
          graphRef.current.d3Force('collision', forceCollide()
            .radius(d => Math.sqrt(d.memberCount) * 8 + 40) // Larger collision radius
            .strength(0.5) // Higher collision strength
            .iterations(1));
        }

        // Reheat simulation for transition with new forces
        console.log('[ViewSwitch Effect] Reheating simulation for smooth transition');
        graphRef.current.d3ReheatSimulation();

        // Wait for simulation to completely stop, with a minimum wait time
        const minSettlingTime = 6000; // Minimum 6 seconds
        console.log('[ViewSwitch Effect] Will wait at least', minSettlingTime, 'ms for nodes to settle');

        // Keep loading screen visible for minimum time
        setTimeout(() => {
          console.log('[ViewSwitch Effect] Minimum settling time reached - hiding loading screen');
          isUpdatingView.current = false;
          setIsTransitioning(false);
        }, minSettlingTime);
      }, 50);
    } else {
      console.log('[ViewSwitch Effect] No data change needed - already correct mode');
    }
  }, [viewMode, rawData, clusterData, data]);

  // Sync external function selection into search box
  useEffect(() => {
    if (!searchFunctionName) return;
    setSearchInput(searchFunctionName);
  }, [searchFunctionName]);

  // Trigger search once data & graph are ready (acts like pressing the Search button)
  useEffect(() => {
    if (!searchFunctionName) return;

    // Store latest external term
    pendingExternalSearchRef.current = searchFunctionName;

    // If data/graph not ready yet, wait until they are
    if (!rawData || !graphRef.current) return;

    const term = pendingExternalSearchRef.current;
    if (!term) return;

    pendingExternalSearchRef.current = null;
    setSearchTerm(term);
  }, [searchFunctionName, rawData]);

  if (loading) {
    return <div style={{ padding: '20px', color: '#fff' }}>Loading call graph data...</div>;
  }

  if (!data) {
    return <div style={{ padding: '20px', color: '#fff' }}>Error loading data</div>;
  }

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
      {/* Loading indicator for view transitions */}
      {isTransitioning && (
        <>
          {/* Full-screen black overlay to hide moving nodes */}
          <div style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            background: '#000000',
            zIndex: 1999
          }}></div>

          {/* Loading message */}
          <div style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            background: 'rgba(0, 0, 0, 0.85)',
            color: 'white',
            padding: '20px 40px',
            borderRadius: '10px',
            zIndex: 2000,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '15px',
            fontSize: '16px',
            fontWeight: 'bold',
            boxShadow: '0 4px 20px rgba(0, 0, 0, 0.5)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
              <div style={{
                width: '20px',
                height: '20px',
                border: '3px solid #ffffff',
                borderTopColor: 'transparent',
                borderRadius: '50%',
                animation: 'spin 0.8s linear infinite'
              }}></div>
              <style>{`
                @keyframes spin {
                  to { transform: rotate(360deg); }
                }
              `}</style>
              <div>Switching to {viewMode} view...</div>
            </div>
            <div style={{ fontSize: '13px', fontWeight: 'normal', color: '#aaa' }}>
              Positioning nodes...
            </div>
          </div>
        </>
      )}

      {/* Edge Filter Toggle - Only visible in subgraph mode */}
      {isSubgraphMode && (
        <div style={{
          position: 'absolute',
          top: 10,
          right: 10,
          background: 'rgba(255, 255, 255, 0.95)',
          borderRadius: '8px',
          padding: '6px',
          zIndex: 25,
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)',
          display: 'flex',
          gap: '2px'
        }}>
          <button
            onClick={() => setEdgeFilterMode('all')}
            style={{
              padding: '8px 14px',
              borderRadius: '6px',
              border: 'none',
              background: edgeFilterMode === 'all' ? '#3b82f6' : '#f3f4f6',
              color: edgeFilterMode === 'all' ? 'white' : '#374151',
              fontSize: '13px',
              fontWeight: '600',
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
          >
            All
          </button>
          <button
            onClick={() => setEdgeFilterMode('incoming')}
            style={{
              padding: '8px 14px',
              borderRadius: '6px',
              border: 'none',
              background: edgeFilterMode === 'incoming' ? '#22c55e' : '#f3f4f6',
              color: edgeFilterMode === 'incoming' ? 'white' : '#374151',
              fontSize: '13px',
              fontWeight: '600',
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
          >
            Incoming ({subgraphAllInEdgesRef.current.size})
          </button>
          <button
            onClick={() => setEdgeFilterMode('outgoing')}
            style={{
              padding: '8px 14px',
              borderRadius: '6px',
              border: 'none',
              background: edgeFilterMode === 'outgoing' ? '#f97316' : '#f3f4f6',
              color: edgeFilterMode === 'outgoing' ? 'white' : '#374151',
              fontSize: '13px',
              fontWeight: '600',
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
          >
            Outgoing ({subgraphAllOutEdgesRef.current.size})
          </button>
        </div>
      )}

      {/* Panel Toggle Button - icon only (local/backend 공통) */}
      <button
        onClick={() => setIsPanelOpen(prev => !prev)}
        style={{
          position: 'absolute',
          top: 10,
          left: 10,
          background: 'rgba(255,255,255,0.95)',
          border: '1px solid #ccc',
          borderRadius: '5px',
          padding: '8px 12px',
          zIndex: 1001,
          cursor: 'pointer',
          fontSize: '14px',
          fontWeight: 'bold',
          boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '36px',
          height: '36px'
        }}
        title={isPanelOpen ? 'Hide call graph panel' : 'Show call graph panel'}
      >
        <span>{isPanelOpen ? '▼' : '▶'}</span>
      </button>

      {/* Panel Content - Toggleable */}
      {isPanelOpen && (
      <div style={{
        position: 'absolute',
        top: 50,
        left: 10,
        background: 'rgba(255,255,255,0.9)',
        padding: '10px',
        borderRadius: '5px',
        zIndex: 1000,
        minWidth: '260px'
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '10px',
          gap: '8px'
        }}>
          <h3 style={{ margin: 0 }}>{title}</h3>
          {onToggleOverview && (
            <button
              type="button"
              onClick={onToggleOverview}
              style={{
                padding: '4px 8px',
                borderRadius: '4px',
                border: '1px solid #d1d5db',
                background: isOverviewOpen ? '#e5e7eb' : '#ffffff',
                color: '#374151',
                fontSize: '11px',
                fontWeight: 600,
                cursor: 'pointer',
                whiteSpace: 'nowrap'
              }}
            >
              {isOverviewOpen ? 'Hide overview' : 'Show overview'}
            </button>
          )}
        </div>

        {/* View Mode Indicator */}
        <div style={{
          padding: '6px 10px',
          marginBottom: '10px',
          borderRadius: '4px',
          background: isSubgraphMode ? '#d97706' : (viewMode === 'cluster' ? '#4a7c59' : '#5a6c7d'),
          color: 'white',
          fontSize: '13px',
          fontWeight: 'bold',
          textAlign: 'center'
        }}>
          {isSubgraphMode ? '🔎 Subgraph View' : (viewMode === 'cluster' ? '📊 Cluster View' : '🔍 Detail View')}
        </div>

        {/* Zoom Level */}
        <div style={{ marginBottom: '10px', fontSize: '12px' }}>
          <div style={{ color: '#666' }}>Zoom: {zoomLevel.toFixed(2)}x</div>
          <div style={{
            height: '4px',
            background: '#ddd',
            borderRadius: '2px',
            overflow: 'hidden',
            marginTop: '3px'
          }}>
            <div style={{
              height: '100%',
              width: `${Math.min((zoomLevel / 5) * 100, 100)}%`,
              background: viewMode === 'cluster' ? '#4a7c59' : '#5a6c7d',
              transition: 'all 0.3s'
            }}></div>
          </div>
          <div style={{ color: '#888', fontSize: '11px', marginTop: '2px' }}>
            {viewMode === 'cluster'
              ? `Zoom in (≥${ZOOM_THRESHOLD_ENTER_DETAIL.toFixed(1)}x) for details`
              : `Zoom out (<${ZOOM_THRESHOLD_EXIT_DETAIL.toFixed(1)}x) for clusters`}
          </div>
        </div>

        {/* Search Input */}
        <div style={{ marginBottom: '10px' }}>
          <div style={{ display: 'flex', gap: '5px' }}>
            <input
              type="text"
              placeholder="Search functions..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  setSearchTerm(searchInput);
                }
              }}
              style={{
                flex: 1,
                padding: '8px',
                borderRadius: '4px',
                border: '1px solid #ccc',
                fontSize: '14px',
                boxSizing: 'border-box'
              }}
            />
            <button
              onClick={() => setSearchTerm(searchInput)}
              style={{
                padding: '8px 16px',
                borderRadius: '4px',
                border: 'none',
                background: '#4a7c59',
                color: 'white',
                fontSize: '14px',
                fontWeight: 'bold',
                cursor: 'pointer',
                whiteSpace: 'nowrap'
              }}
            >
              Search
            </button>
            {searchTerm && (
              <button
                onClick={() => {
                  setSearchInput('');
                  setSearchTerm('');
                }}
                style={{
                  padding: '8px 12px',
                  borderRadius: '4px',
                  border: 'none',
                  background: '#dc2626',
                  color: 'white',
                  fontSize: '14px',
                  fontWeight: 'bold',
                  cursor: 'pointer'
                }}
              >
                ✕
              </button>
            )}
          </div>
          {isSubgraphMode && searchTerm && (
            <div style={{ fontSize: '12px', marginTop: '5px', color: '#d97706', fontWeight: 'bold' }}>
              <div>Showing subgraph: {data.nodes.length} nodes</div>
              <div style={{ fontSize: '11px', color: '#888', fontWeight: 'normal', marginTop: '3px' }}>
                Matched: {highlightNodesRef.current.size} | Neighbors: {data.nodes.length - highlightNodesRef.current.size}
              </div>
              <div style={{ fontSize: '11px', color: '#666', marginTop: '5px' }}>
                💡 Click ✕ or clear search to return to full graph
              </div>
            </div>
          )}
        </div>

        {/* Statistics */}
        <div style={{ fontSize: '13px', marginBottom: '5px' }}>
          {isSubgraphMode ? (
            <>
              <div>Subgraph nodes: {data.nodes.length}</div>
              <div>Edges: {data.links.length}</div>
              <div style={{ color: '#888', fontSize: '11px', marginTop: '3px' }}>
                Full graph: {rawData?.nodes.length || 0} functions
              </div>
            </>
          ) : viewMode === 'cluster' ? (
            <>
              <div>Files: {clusterData?.nodes.length || 0}</div>
              <div>Inter-file links: {clusterData?.links.length || 0}</div>
              <div style={{ color: '#888', fontSize: '11px', marginTop: '3px' }}>
                Total functions: {rawData?.nodes.length || 0}
              </div>
            </>
          ) : (
            <>
              <div>Functions: {data.nodes.length}</div>
              <div>Calls: {data.links.length}</div>
              <div style={{ color: '#888', fontSize: '11px', marginTop: '3px' }}>
                From {clusterData?.nodes.length || 0} source files
              </div>
            </>
          )}
        </div>

        <div style={{ fontSize: '11px', marginTop: '8px', color: '#666', borderTop: '1px solid #ddd', paddingTop: '8px' }}>
          <div>• Drag to pan</div>
          <div>• Scroll to zoom in/out</div>
          <div>• Click node for info</div>
          <div>• Drag nodes to move</div>
        </div>
      </div>
      )}

      <div ref={containerRef} style={{ width: '100%', height: '100%' }}></div>
    </div>
  );
};

export default CallGraphWebGL;
