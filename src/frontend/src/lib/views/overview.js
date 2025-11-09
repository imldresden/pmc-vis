import { overviewStylesheet } from '../style/views/overview-cy-style.js';
import { OKABE_ITO_COLORS } from '../style/views/variables.js';
import { h, t } from '../utils/utils.js';
import { cytoscape } from './imports/import-cytoscape.js';
import { socket } from './imports/import-socket.js';

let DISTANCE_BETWEEN_LEVELS = 180; // Default distance between levels in pixels
let DISTANCE_BETWEEN_NODES_IN_LEVEL = 150; // Default distance between nodes in pixels
let LAYOUT_DIRECTION = 'vertical'; // 'horizontal' or 'vertical'

// Store edge notes in memory
const edgeNotes = new Map();

// Track currently selected edge
let selectedEdgeId = null;

const INITIAL_HORIZONTAL_POSITION = {
  X: 50,
  Y: -50,
};

const INITIAL_VERTICAL_POSITION = {
  X: 50,
  Y: 50,
};

// Helper function to get color for level
function getColorForLevel(level) {
  return OKABE_ITO_COLORS[parseInt(level) % OKABE_ITO_COLORS.length];
}

// Helper function to calculate edge segment properties for a single edge
function calculateEdgeSegments(sourceNode, targetNode) {
  const AX = sourceNode.position('x');
  const AY = sourceNode.position('y');
  const BX = targetNode.position('x');
  const BY = targetNode.position('y');

  const P1Item = sourceNode.data('item') || 1;
  const P1Color = getColorForLevel(P1Item);

  let P1X;
  let P1Y;
  let P2X;
  let P2Y;

  if (LAYOUT_DIRECTION === 'horizontal') {
    // Horizontal layout: edges curve horizontally
    P1Y = AY;
    P1X = BX - 10 * P1Item - 20;
    P2Y = BY;
    P2X = P1X;
  } else {
    // Vertical layout: edges curve vertically
    P1X = AX;
    P1Y = BY - 10 * P1Item - 20;
    P2X = BX;
    P2Y = P1Y;
  }

  // Calculate distances from P1 and P2 to line AB
  const lineLength = Math.sqrt((BY - AY) ** 2 + (BX - AX) ** 2);

  // Distance from P1 to line AB (with sign)
  const distance1 = lineLength > 0
    ? ((BY - AY) * P1X - (BX - AX) * P1Y + BX * AY - BY * AX) / lineLength : 0;

  // Distance from P2 to line AB (with sign)
  const distance2 = lineLength > 0
    ? ((BY - AY) * P2X - (BX - AX) * P2Y + BX * AY - BY * AX) / lineLength : 0;

  // Calculate projections of P1 and P2 onto line AB
  const AB_length_squared = (BX - AX) ** 2 + (BY - AY) ** 2;

  // Projection of P1 onto AB
  const P1_projection = AB_length_squared > 0
    ? ((P1X - AX) * (BX - AX) + (P1Y - AY) * (BY - AY)) / AB_length_squared : 0.5;

  // Projection of P2 onto AB
  const P2_projection = AB_length_squared > 0
    ? ((P2X - AX) * (BX - AX) + (P2Y - AY) * (BY - AY)) / AB_length_squared : 0.5;

  // Validate values before applying
  const validDistance1 = isNaN(distance1) ? 0 : distance1;
  const validDistance2 = isNaN(distance2) ? 0 : distance2;
  const validProjection1 = isNaN(P1_projection) ? 0.5 : P1_projection;
  const validProjection2 = isNaN(P2_projection) ? 0.5 : P2_projection;

  return {
    color: P1Color,
    segmentDistances: [-validDistance1, -validDistance2],
    segmentWeights: [validProjection1, validProjection2],
  };
}

// Function to apply custom segment distances to edges (adapted from customLayout.js)
function applyCustomSegmentDistances(cy) {
  let i = 0;
  cy.edges().forEach(edge => {
    console.log('edge', i, edge);
    i += 1;
    try {
      const sourceNode = edge.source();
      const targetNode = edge.target();
      const segments = calculateEdgeSegments(sourceNode, targetNode);

      edge.style('line-color', segments.color);
      edge.style('target-arrow-color', segments.color);
      edge.style('segment-distances', segments.segmentDistances);
      edge.style('segment-weights', segments.segmentWeights);
    } catch (error) {
      console.error('Error applying segment distances to edge:', error);
    }
  });
}

// Helper function to find all paths from root to target node (adapted from customLayout.js)
function findAllPathsToRoot(cy, targetNode) {
  const allPaths = [];

  function findPathsRecursive(currentNode, currentPath) {
    const incomers = currentNode.incomers();

    if (incomers.length === 0) {
      // Reached root or leaf node
      allPaths.push([...currentPath]);
      return;
    }

    // For each incoming edge, continue the path
    incomers.forEach(edge => {
      const parent = edge.source();
      findPathsRecursive(parent, [parent, ...currentPath]);
    });
  }

  findPathsRecursive(targetNode, [targetNode]);
  return allPaths;
}

// Helper function to get all edges in the path (adapted from customLayout.js)
function getPathEdges(pathNodes) {
  const pathEdges = [];
  for (let i = 0; i < pathNodes.length - 1; i += 1) {
    const edge = pathNodes[i].edgesTo(pathNodes[i + 1]);
    if (edge.length > 0) {
      pathEdges.push(edge);
    }
  }
  return pathEdges;
}

// Function to calculate and set dynamic width and height for cy-overview
function updateCyOverviewDimensions(cy) {
  const nodes = cy.nodes();
  if (nodes.length === 0) return;

  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;

  // Find the bounding box of all nodes
  nodes.forEach(node => {
    const pos = node.position();
    const width = node.width();
    const height = node.height();

    minX = Math.min(minX, pos.x - width / 2);
    maxX = Math.max(maxX, pos.x + width / 2);
    minY = Math.min(minY, pos.y - height / 2);
    maxY = Math.max(maxY, pos.y + height / 2);
  });

  // Calculate required width and height with padding
  const padding = 300; // Extra padding around the content
  const requiredWidth = Math.max(maxX - minX + padding, window.innerWidth * 0.5);
  const requiredHeight = Math.max(maxY - minY + padding, window.innerHeight * 0.5);

  // Update the cy-overview div dimensions
  const cyOverview = document.getElementById('cy-overview');
  const scrollContainer = document.getElementById('overview-scroll-container');
  if (cyOverview) {
    cyOverview.style.width = `${requiredWidth}px`;
    cyOverview.style.height = `${requiredHeight}px`;
  }

  // Update scroll container based on layout direction
  if (scrollContainer) {
    if (LAYOUT_DIRECTION === 'horizontal') {
      scrollContainer.style.overflowX = 'auto';
      scrollContainer.style.overflowY = 'hidden';
    } else {
      scrollContainer.style.overflowX = 'hidden';
      scrollContainer.style.overflowY = 'auto';
    }
  }
}

// Function to render edge boxes (only for vertical layout)
function renderEdgeBoxes(cy) {
  const edgeBoxesContainer = document.getElementById('edge-boxes-container');
  if (!edgeBoxesContainer) return;

  // Clear existing boxes
  edgeBoxesContainer.innerHTML = '';

  const edges = cy.edges();
  if (edges.length === 0) {
    edgeBoxesContainer.style.display = 'none';
    return;
  }

  // Group edges by source node level
  const edgesBySourceLevel = {};
  edges.forEach(edge => {
    const sourceNode = edge.source();
    const sourceLevel = sourceNode.data('level') || 0;

    edgesBySourceLevel[sourceLevel] ||= [];
    edgesBySourceLevel[sourceLevel].push(edge);
  });

  if (LAYOUT_DIRECTION === 'horizontal') {
    // Horizontal layout: boxes rotated 90 degrees, positioned at source node x
    // Calculate minimum y position of all nodes in the graph
    const allNodes = cy.nodes();
    let minY = Infinity;
    allNodes.forEach(node => {
      const nodePos = node.position();
      const nodeHeight = node.height();
      const nodeY = nodePos.y - nodeHeight / 2; // Top of the node
      minY = Math.min(minY, nodeY);
    });

    // The y position should be a little less than the minimum y of nodes in the graph
    const boxY = minY - 60; // 60px above the minimum y

    // Process each group of edges (by source level)
    const sortedLevels = Object.keys(edgesBySourceLevel).sort((a, b) => parseInt(a) - parseInt(b));
    sortedLevels.forEach(sourceLevel => {
      const edgeGroup = edgesBySourceLevel[sourceLevel];

      // Sort edges by source node's item value to maintain consistent order
      edgeGroup.sort((a, b) => {
        const sourceA = a.source();
        const sourceB = b.source();
        const itemA = sourceA.data('item') || 0;
        const itemB = sourceB.data('item') || 0;
        return itemA - itemB;
      });

      // Get the first edge's source node position (for positioning the group)
      const firstEdge = edgeGroup[0];
      const firstSourceNode = firstEdge.source();
      const sourcePos = firstSourceNode.position();

      // The x position of the first box should match the source node's x position
      const firstBoxX = sourcePos.x;

      // Box width for horizontal spacing (boxes to the right of first box)
      const boxSpacing = 56; // Spacing between boxes

      // Create boxes for each edge in this group
      edgeGroup.forEach((edge, index) => {
        const edgeId = edge.id();
        const edgeLabel = edge.data('label') || '';
        const currentNote = edgeNotes.get(edgeId) || '';

        // Calculate positions:
        // X: first box at source node x, others to the right
        const boxX = firstBoxX + index * boxSpacing;
        // Y: all boxes at the same y position (above all nodes)

        // Create box container with absolute positioning and 90 degree rotation
        const box = h('div', {
          class: 'edge-box edge-box-horizontal',
          'data-edge-id': edgeId,
          style: `position: absolute; left: ${boxX}px; top: ${boxY}px; transform: rotate(-45deg); transform-origin: left top;`,
        }, []);

        // First part: edge label
        const labelPart = h('div', { class: 'edge-box-label' }, [t(edgeLabel)]);

        // Second part: input for notes
        const noteInput = h('input', {
          type: 'text',
          class: 'edge-box-note-input',
          value: currentNote,
        }, []);

        // Store note when user types
        noteInput.addEventListener('input', (e) => {
          edgeNotes.set(edgeId, e.target.value);
        });

        const notePart = h('div', { class: 'edge-box-note' }, [noteInput]);

        box.appendChild(labelPart);
        box.appendChild(notePart);

        // Add hover event listeners to highlight corresponding edge
        box.addEventListener('mouseenter', () => {
          // Only add hover highlight if not selected
          if (selectedEdgeId !== edgeId) {
            const correspondingEdge = cy.getElementById(edgeId);
            if (correspondingEdge.length > 0) {
              correspondingEdge.addClass('edge-highlighted');
            }
            box.classList.add('edge-box-highlighted');
          }
        });

        box.addEventListener('mouseleave', () => {
          // Only remove hover highlight if not selected
          if (selectedEdgeId !== edgeId) {
            const correspondingEdge = cy.getElementById(edgeId);
            if (correspondingEdge.length > 0) {
              correspondingEdge.removeClass('edge-highlighted');
            }
            box.classList.remove('edge-box-highlighted');
          }
        });

        // Add click event listener to select edge
        box.addEventListener('click', (e) => {
          e.stopPropagation();
          selectEdge(cy, edgeId);
        });

        edgeBoxesContainer.appendChild(box);
      });
    });
  } else {
    // Vertical layout: boxes in rows, positioned to the right of the graph
    // Calculate x position - place boxes to the right of the graph
    // Get the rightmost node position to determine where to place boxes
    const allNodes = cy.nodes();
    let maxX = 0;
    allNodes.forEach(node => {
      const nodePos = node.position();
      const nodeWidth = node.width();
      maxX = Math.max(maxX, nodePos.x + nodeWidth / 2);
    });

    const boxX = maxX + 50; // 50px spacing from the rightmost node

    // Process each group of edges (by source level)
    const sortedLevels = Object.keys(edgesBySourceLevel).sort((a, b) => parseInt(a) - parseInt(b));
    sortedLevels.forEach(sourceLevel => {
      const edgeGroup = edgesBySourceLevel[sourceLevel];

      // Sort edges by source node's item value to maintain consistent order
      edgeGroup.sort((a, b) => {
        const sourceA = a.source();
        const sourceB = b.source();
        const itemA = sourceA.data('item') || 0;
        const itemB = sourceB.data('item') || 0;
        return itemA - itemB;
      });

      // Get the first edge's source node position (for positioning the group)
      const firstEdge = edgeGroup[0];
      const firstSourceNode = firstEdge.source();
      const sourcePos = firstSourceNode.position();

      // The y position of the first box should match the source node's y position
      const firstBoxY = sourcePos.y;

      // Box height for spacing (approximate, will be adjusted by actual box height)
      const boxHeight = 40;

      // Create boxes for each edge in this group
      edgeGroup.forEach((edge, index) => {
        const edgeId = edge.id();
        const edgeLabel = edge.data('label') || '';
        const currentNote = edgeNotes.get(edgeId) || '';

        // Calculate y position: first box at source node y, others stacked below
        const boxY = firstBoxY + index * boxHeight;

        // Create box container with absolute positioning
        const box = h('div', {
          class: 'edge-box',
          'data-edge-id': edgeId,
          style: `position: absolute; left: ${boxX}px; top: ${boxY}px;`,
        }, []);

        // First part: edge label
        const labelPart = h('div', { class: 'edge-box-label' }, [t(edgeLabel)]);

        // Second part: input for notes
        const noteInput = h('input', {
          type: 'text',
          class: 'edge-box-note-input',
          value: currentNote,
        }, []);

        // Store note when user types
        noteInput.addEventListener('input', (e) => {
          edgeNotes.set(edgeId, e.target.value);
        });

        const notePart = h('div', { class: 'edge-box-note' }, [noteInput]);

        box.appendChild(labelPart);
        box.appendChild(notePart);

        // Add hover event listeners to highlight corresponding edge
        box.addEventListener('mouseenter', () => {
          // Only add hover highlight if not selected
          if (selectedEdgeId !== edgeId) {
            const correspondingEdge = cy.getElementById(edgeId);
            if (correspondingEdge.length > 0) {
              correspondingEdge.addClass('edge-highlighted');
            }
            box.classList.add('edge-box-highlighted');
          }
        });

        box.addEventListener('mouseleave', () => {
          // Only remove hover highlight if not selected
          if (selectedEdgeId !== edgeId) {
            const correspondingEdge = cy.getElementById(edgeId);
            if (correspondingEdge.length > 0) {
              correspondingEdge.removeClass('edge-highlighted');
            }
            box.classList.remove('edge-box-highlighted');
          }
        });

        // Add click event listener to select edge
        box.addEventListener('click', (e) => {
          e.stopPropagation();
          selectEdge(cy, edgeId);
        });

        edgeBoxesContainer.appendChild(box);
      });
    });
  }

  // Make container visible and position it relative to cy-overview (same coordinate system)
  edgeBoxesContainer.style.display = 'block';
  edgeBoxesContainer.style.position = 'absolute';
  edgeBoxesContainer.style.top = '0';
  edgeBoxesContainer.style.left = '0';
  edgeBoxesContainer.style.width = 'auto';
  edgeBoxesContainer.style.height = 'auto';
  edgeBoxesContainer.style.background = 'transparent';
  edgeBoxesContainer.style.border = 'none';
  edgeBoxesContainer.style.boxShadow = 'none';
  edgeBoxesContainer.style.padding = '0';
  edgeBoxesContainer.style.zIndex = '5';
  edgeBoxesContainer.style.pointerEvents = 'none'; // Allow clicks to pass through to cytoscape
}

// Function to select an edge and its corresponding box
function selectEdge(cy, edgeId) {
  // Clear previous selection
  clearSelection(cy);

  // Set new selection
  selectedEdgeId = edgeId;

  // Highlight the selected edge
  const selectedEdge = cy.getElementById(edgeId);
  if (selectedEdge.length > 0) {
    selectedEdge.addClass('edge-selected');
  }

  // Highlight the corresponding box
  const correspondingBox = document.querySelector(`[data-edge-id="${edgeId}"]`);
  if (correspondingBox) {
    correspondingBox.classList.add('edge-box-selected');
  }
}

// Function to clear selection
function clearSelection(cy) {
  if (selectedEdgeId) {
    // Remove selection from edge
    const selectedEdge = cy.getElementById(selectedEdgeId);
    if (selectedEdge.length > 0) {
      selectedEdge.removeClass('edge-selected');
      selectedEdge.removeClass('edge-highlighted');
    }

    // Remove selection and highlight from box
    const correspondingBox = document.querySelector(`[data-edge-id="${selectedEdgeId}"]`);
    if (correspondingBox) {
      correspondingBox.classList.remove('edge-box-selected');
      correspondingBox.classList.remove('edge-box-highlighted');
    }

    selectedEdgeId = null;
  }

  // Also clear any lingering highlighted states from all boxes and edges
  const allBoxes = document.querySelectorAll('.edge-box');
  allBoxes.forEach(box => {
    box.classList.remove('edge-box-highlighted');
    box.classList.remove('edge-box-selected');
  });

  cy.edges().forEach(edge => {
    edge.removeClass('edge-highlighted');
    edge.removeClass('edge-selected');
  });
}

// Function to calculate level spacing adjustments based on edge note counts
function calculateLevelSpacingAdjustments(cy) {
  const edges = cy.edges();
  const levelAdjustments = {}; // Maps level -> spacing adjustment needed before this level

  // Group edges by source node level
  const edgesBySourceLevel = {};
  edges.forEach(edge => {
    const sourceNode = edge.source();
    const sourceLevel = sourceNode.data('level') || 0;

    edgesBySourceLevel[sourceLevel] ||= [];
    edgesBySourceLevel[sourceLevel].push(edge);
  });

  // Calculate adjustments for each level transition
  Object.keys(edgesBySourceLevel).forEach(sourceLevel => {
    const edgeGroup = edgesBySourceLevel[sourceLevel];

    // If this group has more than 3 edge notes, add extra spacing
    if (edgeGroup.length > 3) {
      // Find all target levels for edges in this group
      const targetLevels = new Set();
      edgeGroup.forEach(edge => {
        const targetNode = edge.target();
        const targetLevel = targetNode.data('level') || 0;
        targetLevels.add(targetLevel);
      });

      // Calculate extra spacing needed (additional space per edge note beyond 3)
      const extraSpacing = (edgeGroup.length - 3) * (LAYOUT_DIRECTION === 'vertical' ? 20 : 60);

      // Apply adjustment to target levels - we need to push these levels and all subsequent levels
      targetLevels.forEach(targetLevel => {
        const levelNum = parseInt(targetLevel);
        const sourceLevelNum = parseInt(sourceLevel);

        // Only add spacing if target level is greater than source level
        if (levelNum > sourceLevelNum) {
          // Store the maximum spacing needed before this level
          levelAdjustments[levelNum] ||= 0;
          levelAdjustments[levelNum] = Math.max(levelAdjustments[levelNum], extraSpacing);
        }
      });
    }
  });

  // Convert to cumulative adjustments (each level gets spacing from all previous levels)
  const cumulativeAdjustments = {};
  let cumulative = 0;
  const allLevels = cy.nodes().map(n => parseInt(n.data('level') || 0));
  const maxLevel = Math.max(...allLevels, 0);

  // Calculate cumulative spacing for each level
  for (let level = 0; level <= maxLevel; level += 1) {
    if (levelAdjustments[level]) {
      cumulative += levelAdjustments[level];
    }
    cumulativeAdjustments[level] = cumulative;
  }

  return cumulativeAdjustments;
}

// Function to apply custom layout (exact copy from customLayout.js)
function applyCustomLayout(cy) {
  const nodes = cy.nodes();

  // Calculate level spacing adjustments based on edge note counts
  const levelSpacingAdjustments = calculateLevelSpacingAdjustments(cy);

  // Group nodes by level
  const levelGroups = {};
  nodes.forEach(node => {
    const level = node.data('level') || 0;
    levelGroups[level] ||= [];
    levelGroups[level].push(node);
  });

  // Position nodes based on their level
  Object.keys(levelGroups).forEach(level => {
    const levelNum = parseInt(level);
    const nodesInLevel = levelGroups[level];

    // Sort nodes by their item value to maintain consistent order
    nodesInLevel.sort((a, b) => {
      const itemA = a.data('item') || 0;
      const itemB = b.data('item') || 0;
      return itemA - itemB;
    });

    // Get spacing adjustment for this level
    const spacingAdjustment = levelSpacingAdjustments[levelNum] || 0;

    if (LAYOUT_DIRECTION === 'horizontal') {
      // Horizontal layout: levels are columns (x-axis), nodes stacked vertically (y-axis)
      // Add spacing adjustment to push levels with many edge notes
      const columnX = levelNum * DISTANCE_BETWEEN_LEVELS + spacingAdjustment;

      // Stack nodes vertically in each column
      nodesInLevel.forEach((node, index) => {
        // calculate nodeY from bottom to top
        const nodeY = cy.height() - index * DISTANCE_BETWEEN_NODES_IN_LEVEL;

        node.position({
          x: columnX + INITIAL_HORIZONTAL_POSITION.X,
          y: nodeY + INITIAL_HORIZONTAL_POSITION.Y,
        });
      });
    } else {
      // Vertical layout: levels are rows (y-axis), nodes stacked horizontally (x-axis)
      const rowY = levelNum * DISTANCE_BETWEEN_LEVELS + spacingAdjustment; // Add spacing adjustment

      // Stack nodes horizontally in each row
      nodesInLevel.forEach((node, index) => {
        // calculate nodeX from left to right
        const nodeX = index * DISTANCE_BETWEEN_NODES_IN_LEVEL;

        node.position({
          x: nodeX + INITIAL_VERTICAL_POSITION.X,
          y: rowY + INITIAL_VERTICAL_POSITION.Y,
        });
      });
    }
  });

  // Apply custom segment distances to edges
  applyCustomSegmentDistances(cy);

  // Update the dimensions to accommodate all elements
  updateCyOverviewDimensions(cy);

  // Render edge boxes (only for vertical layout)
  renderEdgeBoxes(cy);
}

// Create overview-specific layout params without auto-fit (not used anymore)
// const overviewParams = {
//   ...params,
//   fit: false,
// };

var isInitialized = false;

const $ = document.querySelector.bind(document);
const $overview_graph_config = $('#overview-graph-config');

window.addEventListener('load', () => {
  makeOverviewSettings();
  // Create edge boxes container - place it inside the scroll container
  // so it's in the same coordinate system
  const scrollContainer = document.getElementById('overview-scroll-container');
  if (scrollContainer && !document.getElementById('edge-boxes-container')) {
    const edgeBoxesContainer = h('div', {
      id: 'edge-boxes-container',
      class: 'edge-boxes-container',
    }, []);
    scrollContainer.appendChild(edgeBoxesContainer);

    // Add click listener to clear selection when clicking outside boxes
    scrollContainer.addEventListener('click', (e) => {
      // Only clear if clicking directly on the container, not on a box
      if (e.target === edgeBoxesContainer || e.target === scrollContainer) {
        clearSelection(cy2);
      }
    });
  }
});

var cy2 = cytoscape({
  container: document.getElementById('cy-overview'),
  style: overviewStylesheet,
  layout: {
    name: 'preset',
  },
  userPanningEnabled: false,
  userZoomingEnabled: false,
  boxSelectionEnabled: false,
  selectionType: 'single',
  autoungrabify: true,
  zoom: 1,
  minZoom: 1,
  maxZoom: 1,
});

cy2.ready(() => {
  // Add listeners
  bindListeners(cy2);

  // Add event listeners for custom layout
  let positionUpdateTimeout;
  cy2.on('position', 'node', () => {
    // Debounce the position updates to avoid excessive calls
    clearTimeout(positionUpdateTimeout);
    positionUpdateTimeout = setTimeout(() => {
      applyCustomSegmentDistances(cy2);
    }, 10);
  });
  window.addEventListener('resize', () => {
    applyCustomSegmentDistances(cy2);
    updateCyOverviewDimensions(cy2);
    renderEdgeBoxes(cy2);
  });

  // Initial render of edge boxes
  renderEdgeBoxes(cy2);

  // Add hover effect to highlight all paths from root to hovered node
  cy2.on('mouseover', 'node', (evt) => {
    const hoveredNode = evt.target;

    // Find all paths from root to hovered node
    const allPaths = findAllPathsToRoot(cy2, hoveredNode);

    // Dim all nodes and edges
    cy2.nodes().style('opacity', 0.3);
    cy2.edges().style('opacity', 0.3);

    // Highlight all paths
    allPaths.forEach(pathNodes => {
      const pathEdges = getPathEdges(pathNodes);

      // Highlight path nodes
      pathNodes.forEach(node => {
        node.style('opacity', 1);
      });

      // Highlight path edges
      pathEdges.forEach(edge => {
        edge.style('opacity', 1);
      });
    });
  });

  // Restore original opacity when mouse leaves node
  cy2.on('mouseout', 'node', () => {
    // Restore full opacity to all nodes and edges
    cy2.nodes().style('opacity', 1);
    cy2.edges().style('opacity', 1);
  });

  // Add hover effect to highlight corresponding edge box when hovering over edge
  cy2.on('mouseover', 'edge', (evt) => {
    const hoveredEdge = evt.target;
    const edgeId = hoveredEdge.id();
    // Only add hover highlight if not selected
    if (selectedEdgeId !== edgeId) {
      const correspondingBox = document.querySelector(`[data-edge-id="${edgeId}"]`);
      if (correspondingBox) {
        correspondingBox.classList.add('edge-box-highlighted');
        hoveredEdge.addClass('edge-highlighted');
      }
    }
  });

  cy2.on('mouseout', 'edge', (evt) => {
    const hoveredEdge = evt.target;
    const edgeId = hoveredEdge.id();
    // Only remove hover highlight if not selected
    if (selectedEdgeId !== edgeId) {
      const correspondingBox = document.querySelector(`[data-edge-id="${edgeId}"]`);
      if (correspondingBox) {
        correspondingBox.classList.remove('edge-box-highlighted');
        hoveredEdge.removeClass('edge-highlighted');
      }
    }
  });

  // Add click event listener to select edge
  cy2.on('click', 'edge', (evt) => {
    const clickedEdge = evt.target;
    const edgeId = clickedEdge.id();
    selectEdge(cy2, edgeId);
  });

  // Add click event listener to clear selection when clicking on background
  cy2.on('click', (evt) => {
    // Only clear if clicking on background (not on edge or node)
    // In Cytoscape, clicking on background means target is the core
    if (evt.target === cy2) {
      clearSelection(cy2);
    }
  });
});

socket.on('pane data updated', (data) => {
  if (data) {
    // drawGraph(data);
  }
});

socket.on('pane added', (data) => {
  onPaneAdded(data);

  if (data.id === 'pane-0' && !isInitialized) {
    isInitialized = true;
  }
});

socket.on('pane removed', (data) => {
  removeNode(data);
});

socket.on('active pane', (data) => {
  var nodes = cy2.nodes();

  nodes.forEach((node) => {
    if (node.id() !== data) {
      node.removeClass('active-pane');
    } else {
      node.addClass('active-pane');
    }
  });
});

// TODO: replay selections of the overview workflow with a different model (if blueprint remains)
socket.on('disconnect', () => {
  location.reload();
});

socket.on('duplicate pane ids', (data) => {
  if (data && data.length > 0) {
    data.forEach((nodeId) => {
      cy2
        .style()
        .selector('#' + nodeId)
        .style({
          label: '*',
          'text-halign': 'center',
          'text-valign': 'center',
        })
        .update();
    });
  } else {
    cy2
      .style()
      .selector('node')
      .style({
        label: '',
      })
      .update();
  }
});

socket.on('reset pane-node markings', () => {
  cy2
    .style()
    .selector('node')
    .style({
      label: '',
    })
    .update();
});

function onPaneAdded(newPaneData) {
  const paneId = newPaneData.id;
  const spawnerNodes = newPaneData.spawnerNodes;
  const spawner = [];

  if (paneId !== 'pane-0') {
    const isDuplicate = paneId.includes('DUPLICATE');
    if (newPaneData.spawner && Array.isArray(newPaneData.spawner)) {
      // Handle multiple spawners (merged panes)
      newPaneData.spawner.forEach((spawnerId) => {
        spawner.push({
          data: {
            id: spawnerId + paneId,
            source: spawnerId,
            target: paneId,
            label: 'merged',
          },
          classes: 'merge-edge',
        });
      });
    } else if (newPaneData.spawner) {
      // Handle single spawner
      spawner.push({
        data: {
          id: spawnerNodes?.join(', ') + paneId,
          source: newPaneData.spawner,
          target: paneId,
          label: isDuplicate
            ? 'DUPL-' + spawnerNodes?.join(', ')
            : spawnerNodes?.join(', '),
        },
      });
    }
  }

  // Calculate level and item data before adding the node
  let level = 0;
  if (newPaneData.spawner) {
    // Handle both single spawner and array of spawners (for merged panes)
    const spawners = Array.isArray(newPaneData.spawner)
      ? newPaneData.spawner
      : [newPaneData.spawner];

    // Find the maximum level among all spawners and add 1
    let maxParentLevel = -1;
    spawners.forEach(spawnerId => {
      const parentNode = cy2.getElementById(spawnerId);
      if (parentNode.length > 0) {
        const parentLevel = parentNode.data('level') || 0;
        maxParentLevel = Math.max(maxParentLevel, parentLevel);
      }
    });

    if (maxParentLevel >= 0) {
      level = maxParentLevel + 1;
    }
  }

  // Calculate item value (same logic as customLayout.js)
  const nodesAtLevel = cy2.nodes().filter(n => n.data('level') === level);
  const itemValue = nodesAtLevel.length + 1;

  // Calculate initial position based on level and item
  let initialPosition = { x: 0, y: 0 };

  if (LAYOUT_DIRECTION === 'horizontal') {
    // Horizontal layout: levels are columns (x-axis), nodes stacked vertically (y-axis)
    const columnX = level * DISTANCE_BETWEEN_LEVELS;
    const nodeY = cy2.height() - (itemValue - 1) * DISTANCE_BETWEEN_NODES_IN_LEVEL;

    initialPosition = {
      x: columnX + INITIAL_HORIZONTAL_POSITION.X,
      y: nodeY + INITIAL_HORIZONTAL_POSITION.Y,
    };
  } else {
    // Vertical layout: levels are rows (y-axis), nodes stacked horizontally (x-axis)
    const rowY = level * DISTANCE_BETWEEN_LEVELS;
    const nodeX = (itemValue - 1) * DISTANCE_BETWEEN_NODES_IN_LEVEL;

    initialPosition = {
      x: nodeX + INITIAL_VERTICAL_POSITION.X,
      y: rowY + INITIAL_VERTICAL_POSITION.Y,
    };
  }

  const elements = {
    nodes: [
      {
        data: {
          id: paneId,
          label: paneId,
          level: level,
          item: itemValue,
        },
        position: initialPosition,
        style: {
          opacity: 0.3,
          shape: 'rectangle',
        },
      },
    ],
    edges: spawner,
  };

  cy2.add(elements);

  // Apply edge segments immediately after adding elements to prevent flash
  spawner.forEach(edgeData => {
    if (edgeData.data.source && edgeData.data.target) {
      const sourceNode = cy2.getElementById(edgeData.data.source);
      const targetNode = cy2.getElementById(edgeData.data.target);
      const edge = cy2.getElementById(edgeData.data.id);

      if (sourceNode.length > 0 && targetNode.length > 0 && edge.length > 0) {
        const segments = calculateEdgeSegments(sourceNode, targetNode);
        edge.style('line-color', segments.color);
        edge.style('target-arrow-color', segments.color);
        edge.style('segment-distances', segments.segmentDistances);
        edge.style('segment-weights', segments.segmentWeights);
      }
    }
  });

  // Update dimensions after adding new elements
  setTimeout(() => {
    updateCyOverviewDimensions(cy2);
  }, 10);

  // Apply custom layout after elements are added (for edge positioning and other adjustments)
  setTimeout(() => {
    applyCustomLayout(cy2);
    renderEdgeBoxes(cy2);
  }, 50);
}

// function drawGraph(panesStr) {
//   const panesJson = JSON.parse(panesStr);

//   const panes = panesJson;

//   const edges = Object.entries(panes).reduce((acc, [id, { nodesIds }]) => {
//     nodesIds?.forEach((node) => {
//       acc[node] = acc[node] || {};

//       if (acc[node].source) {
//         acc[node].target = id;
//       } else {
//         acc[node].source = id;
//       }
//     });
//     return acc;
//   }, {});

//   const filteredEdges = Object.fromEntries(
//     Object.entries(edges).filter(
//       ([node, { source, target }]) => source && target
//     )
//   );
//   const elements = {
//     nodes: Object.keys(panes).map((paneId) => {
//       return {
//         data: {
//           id: paneId,
//           label: paneId.length > 10 ? paneId.slice(3, 7) : paneId,
//         },
//         style: {
//           "background-color": panes[paneId].backgroundColor,
//           opacity: 0.3,
//           shape: "rectangle",
//           width: 20,
//           height: 20,
//         },
//       };
//     }),
//     edges: Object.keys(filteredEdges).map((edgeId) => {
//       return {
//         data: {
//           id: edgeId,
//           source: filteredEdges[edgeId].source,
//           target: filteredEdges[edgeId].target,
//           label: edgeId,
//         },
//       };
//     }),
//   };
//   cy2.add(elements);
//   cy2.layout(params).run();
// }

function removeNode(id) {
  const nodeIdToRemove = id;

  // Remove associated edges and their notes
  const edgesToRemove = cy2.edges(`[source="${nodeIdToRemove}"], [target="${nodeIdToRemove}"]`);
  edgesToRemove.forEach(edge => {
    edgeNotes.delete(edge.id());
  });
  edgesToRemove.remove();

  // remove node
  cy2.remove('#' + nodeIdToRemove);

  // Update edge boxes after removal
  renderEdgeBoxes(cy2);
}

function bindListeners(cy2) {
  cy2.on('click', 'node', e => {
    var node = e.target;
    // Clear edge selection when clicking on a node
    clearSelection(cy2);
    socket.emit('overview node clicked', node.id());
  });

  cy2.on('select', () => {
    var selectedNodes = cy2.$('node:selected');

    var selectedNodeIDs = selectedNodes.map((node) => node.id());
    socket.emit('overview nodes selected', selectedNodeIDs);
  });
}

function makeOverviewSettings() {
  const $buttons = h('div', { class: 'buttons param' }, []);
  const $buttons2 = h('div', { class: 'buttons param' }, []);
  const $buttons3 = h('div', { class: 'buttons param' }, []);
  const $levelDistanceConfig = h('div', { class: 'param' }, []);

  const $buttonMerge = h(
    'button',
    { class: 'ui button', id: 'child-button' },
    [h('i', { class: 'fa-solid fa-object-group button-icon' }, []), h('span', {}, [t('Merge')])],
  );
  const $buttonRemove = h(
    'button',
    { class: 'ui button', id: 'child-button' },
    [h('i', { class: 'fa-solid fa-trash button-icon' }, []), h('span', {}, [t('Remove')])],
  );
  const $buttonDuplicate = h(
    'button',
    { class: 'ui button', id: 'child-button' },
    [h('i', { class: 'fa-solid fa-copy button-icon' }, []), h('span', {}, [t('Duplicate')])],
  );
  const $buttonExport = h(
    'button',
    { class: 'ui button', id: 'child-button' },
    [h('i', { class: 'fa-solid fa-download button-icon' }, []), h('span', {}, [t('Export')])],
  );
  const $buttonExpand = h(
    'button',
    { class: 'ui button', id: 'child-button' },
    [h('i', { class: 'fa-solid fa-expand button-icon' }, []), h('span', {}, [t('Expand')])],
  );
  const $buttonCollapse = h(
    'button',
    { class: 'ui button', id: 'child-button' },
    [h('i', { class: 'fa-solid fa-compress button-icon' }, []), h('span', {}, [t('Collapse')])],
  );

  // Level Distance Configuration
  const $levelDistanceLabel = h('label', { class: 'label label-info' }, [t('Level Distance')]);
  const $levelDistanceInput = h('input', {
    type: 'range',
    min: '50',
    max: '300',
    value: DISTANCE_BETWEEN_LEVELS,
    id: 'level-distance-slider',
    class: 'ui slider',
  }, []);
  const $levelDistanceValue = h('span', { id: 'level-distance-value' }, [t(DISTANCE_BETWEEN_LEVELS + 'px')]);
  const $levelDistanceContainer = h('div', { class: 'ui input' }, [$levelDistanceInput, $levelDistanceValue]);

  // Node Distance Configuration
  const $nodeDistanceLabel = h('label', { class: 'label label-info' }, [t('Node Distance')]);
  const $nodeDistanceInput = h('input', {
    type: 'range',
    min: '50',
    max: '200',
    value: DISTANCE_BETWEEN_NODES_IN_LEVEL,
    id: 'node-distance-slider',
    class: 'ui slider',
  }, []);
  const $nodeDistanceValue = h('span', { id: 'node-distance-value' }, [t(DISTANCE_BETWEEN_NODES_IN_LEVEL + 'px')]);
  const $nodeDistanceContainer = h('div', { class: 'ui input' }, [$nodeDistanceInput, $nodeDistanceValue]);

  // Layout Direction Configuration
  const $layoutDirectionLabel = h('label', { class: 'label label-info' }, [t('Layout Direction')]);

  // Radio button for horizontal layout
  const $horizontalRadio = h('input', {
    type: 'radio',
    id: 'layout-horizontal',
    name: 'layout-direction',
    value: 'horizontal',
    checked: LAYOUT_DIRECTION === 'horizontal',
  }, []);
  const $horizontalLabel = h('label', { for: 'layout-horizontal', class: 'radio-label' }, [t('Horizontal')]);
  const $horizontalContainer = h('div', { class: 'radio-option' }, [$horizontalRadio, $horizontalLabel]);

  // Radio button for vertical layout
  const $verticalRadio = h('input', {
    type: 'radio',
    id: 'layout-vertical',
    name: 'layout-direction',
    value: 'vertical',
    checked: LAYOUT_DIRECTION === 'vertical',
  }, []);
  const $verticalLabel = h('label', { for: 'layout-vertical', class: 'radio-label' }, [t('Vertical')]);
  const $verticalContainer = h('div', { class: 'radio-option' }, [$verticalRadio, $verticalLabel]);

  const $layoutDirectionContainer = h('div', { class: 'radio-group' }, [$horizontalContainer, $verticalContainer]);

  // Explicitly set the correct radio button as checked after DOM creation
  setTimeout(() => {
    if (LAYOUT_DIRECTION === 'horizontal') {
      $horizontalRadio.checked = true;
      $verticalRadio.checked = false;
    } else {
      $horizontalRadio.checked = false;
      $verticalRadio.checked = true;
    }
  }, 0);

  $buttonMerge.addEventListener('click', async () => {
    socket.emit('handle selection', 'merge');
  });
  $buttonRemove.addEventListener('click', async () => {
    socket.emit('handle selection', 'delete');
  });
  $buttonDuplicate.addEventListener('click', async () => {
    socket.emit('handle selection', 'duplicate');
  });
  $buttonExport.addEventListener('click', async () => {
    socket.emit('handle selection', 'export');
  });
  $buttonExpand.addEventListener('click', async () => {
    socket.emit('handle selection', 'expand');
  });
  $buttonCollapse.addEventListener('click', async () => {
    socket.emit('handle selection', 'collapse');
  });

  // Level Distance slider event listener
  $levelDistanceInput.addEventListener('input', (e) => {
    DISTANCE_BETWEEN_LEVELS = parseInt(e.target.value);
    $levelDistanceValue.textContent = DISTANCE_BETWEEN_LEVELS + 'px';
    // Reapply layout with new distance
    applyCustomLayout(cy2);
  });

  // Node Distance slider event listener
  $nodeDistanceInput.addEventListener('input', (e) => {
    DISTANCE_BETWEEN_NODES_IN_LEVEL = parseInt(e.target.value);
    $nodeDistanceValue.textContent = DISTANCE_BETWEEN_NODES_IN_LEVEL + 'px';
    // Reapply layout with new distance
    applyCustomLayout(cy2);
  });

  // Layout Direction radio button event listeners
  $verticalRadio.addEventListener('change', (e) => {
    if (e.target.checked) {
      LAYOUT_DIRECTION = 'vertical';
      // Reapply layout with new direction
      applyCustomLayout(cy2);
      renderEdgeBoxes(cy2);
    }
  });

  $horizontalRadio.addEventListener('change', (e) => {
    if (e.target.checked) {
      LAYOUT_DIRECTION = 'horizontal';
      // Reapply layout with new direction
      applyCustomLayout(cy2);
      renderEdgeBoxes(cy2);
    }
  });

  $buttons.appendChild($buttonMerge);
  $buttons.appendChild($buttonRemove);
  $buttons2.appendChild($buttonDuplicate);
  $buttons2.appendChild($buttonExport);
  $buttons3.appendChild($buttonExpand);
  $buttons3.appendChild($buttonCollapse);

  // Add level distance configuration
  $levelDistanceConfig.appendChild($levelDistanceLabel);
  $levelDistanceConfig.appendChild($levelDistanceContainer);

  // Add node distance configuration
  const $nodeDistanceConfig = h('div', { class: 'param' }, []);
  $nodeDistanceConfig.appendChild($nodeDistanceLabel);
  $nodeDistanceConfig.appendChild($nodeDistanceContainer);

  // Add layout direction configuration
  const $layoutDirectionConfig = h('div', { class: 'param' }, []);
  $layoutDirectionConfig.appendChild($layoutDirectionLabel);
  $layoutDirectionConfig.appendChild($layoutDirectionContainer);

  // Add other buttons to the config section
  $overview_graph_config?.appendChild($buttons3);
  $overview_graph_config?.appendChild($buttons);
  $overview_graph_config?.appendChild($buttons2);
  $overview_graph_config?.appendChild($layoutDirectionConfig);
  $overview_graph_config?.appendChild($levelDistanceConfig);
  $overview_graph_config?.appendChild($nodeDistanceConfig);
}
