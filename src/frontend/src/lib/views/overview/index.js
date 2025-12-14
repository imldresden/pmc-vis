import { overviewStylesheet } from '../../style/views/overview-cy-style.js';
import { OKABE_ITO_COLORS } from '../../style/views/variables.js';
import { h, t } from '../../utils/utils.js';
import { cytoscape } from '../imports/import-cytoscape.js';
import { socket } from '../imports/import-socket.js';
import { applyCompactLayout, renderEdgeBoxes, calculateLevelSpacingAdjustments } from './layouts/compact-layout.js';
import { applyBioFabricLayout } from './layouts/biofabric-layout.js';
import { graphDataStore } from './graph-data.js';

export const LAYOUT_DIRECTIONS = {
  HORIZONTAL: 'horizontal',
  VERTICAL: 'vertical',
};

export const LAYOUT_TYPES = {
  COMPACT: 'compact',
  BIOFABRIC: 'biofabric',
};

let DISTANCE_BETWEEN_LEVELS = 180;
let DISTANCE_BETWEEN_NODES_IN_LEVEL = 150;
let LAYOUT_DIRECTION = LAYOUT_DIRECTIONS.VERTICAL;
let LAYOUT_TYPE = LAYOUT_TYPES.BIOFABRIC;

const INITIAL_HORIZONTAL_POSITION = {
  X: 50,
  Y: -50,
};

const INITIAL_VERTICAL_POSITION = {
  X: 50,
  Y: 50,
};

function getColorForLevel(level) {
  return OKABE_ITO_COLORS[parseInt(level) % OKABE_ITO_COLORS.length];
}

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

  if (LAYOUT_DIRECTION === LAYOUT_DIRECTIONS.HORIZONTAL) {
    P1Y = AY;
    P1X = BX - 10 * P1Item - 20;
    P2Y = BY;
    P2X = P1X;
  } else {
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
function updateCyOverviewDimensions(cy, layoutDirection) {
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
  const padding = 300;
  const requiredWidth = Math.max(maxX - minX + padding, window.innerWidth);
  const requiredHeight = Math.max(maxY - minY + padding, window.innerHeight);

  // Update the cy-overview div dimensions
  const cyOverview = document.getElementById('cy-overview');
  const compactLayoutContainer = document.getElementById('compact-layout-container');
  if (cyOverview) {
    cyOverview.style.width = `${requiredWidth}px`;
    cyOverview.style.height = `${requiredHeight}px`;
  }

  // Update layout container based on layout direction
  if (compactLayoutContainer) {
    if (layoutDirection === LAYOUT_DIRECTIONS.HORIZONTAL) {
      compactLayoutContainer.style.overflowX = 'auto';
      compactLayoutContainer.style.overflowY = 'hidden';
    } else {
      compactLayoutContainer.style.overflowX = 'hidden';
      compactLayoutContainer.style.overflowY = 'auto';
    }
  }
}

function renderEdgeBoxesWrapper(cy) {
  renderEdgeBoxes(
    graphDataStore,
    cy,
    LAYOUT_DIRECTION,
    LAYOUT_TYPE,
  );
}

// Helper function to find edge box by edge ID (handles both single and comma-separated IDs)
function findEdgeBox(edgeId) {
  // First try exact match
  let box = document.querySelector(`[data-edge-id="${edgeId}"]`);
  if (box) return box;

  // Then try to find boxes with comma-separated IDs that include this edgeId
  const allBoxes = Array.from(document.querySelectorAll('[data-edge-id]'));
  const foundBox = allBoxes.find(b => {
    const boxEdgeIds = b.getAttribute('data-edge-id');
    if (boxEdgeIds && boxEdgeIds.includes(',')) {
      const edgeIds = boxEdgeIds.split(',').map(id => id.trim());
      return edgeIds.includes(edgeId);
    }
    return false;
  });
  return foundBox || null;
}

function selectEdge(cy, edgeId) {
  graphDataStore.clearSelectedEdge();

  graphDataStore.setSelectedEdgeId(edgeId);

  const selectedEdge = cy.getElementById(edgeId);
  if (selectedEdge.length > 0) {
    selectedEdge.addClass('edge-selected');
  }

  const correspondingBox = findEdgeBox(edgeId);
  if (correspondingBox) {
    correspondingBox.classList.add('edge-box-selected');
  }
}

function clearSelection(cy) {
  const selectedEdgeId = graphDataStore.getSelectedEdgeId();
  if (selectedEdgeId) {
    const selectedEdge = cy.getElementById(selectedEdgeId);
    if (selectedEdge.length > 0) {
      selectedEdge.removeClass('edge-selected');
      selectedEdge.removeClass('edge-highlighted');
    }

    const correspondingBox = findEdgeBox(selectedEdgeId);
    if (correspondingBox) {
      const boxEdgeIds = correspondingBox.getAttribute('data-edge-id');
      if (boxEdgeIds && boxEdgeIds.includes(',')) {
        const edgeIds = boxEdgeIds.split(',').map(id => id.trim());
        edgeIds.forEach(edgeId => {
          const edge = cy.getElementById(edgeId);
          if (edge.length > 0) {
            edge.removeClass('edge-selected');
            edge.removeClass('edge-highlighted');
          }
        });
      }
      correspondingBox.classList.remove('edge-box-selected');
      correspondingBox.classList.remove('edge-box-highlighted');
    }

    graphDataStore.clearSelectedEdge();
  }

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

function applyCompactLayoutWrapper(cy) {
  applyCompactLayout(
    graphDataStore,
    cy,
    LAYOUT_DIRECTION,
    DISTANCE_BETWEEN_LEVELS,
    DISTANCE_BETWEEN_NODES_IN_LEVEL,
    INITIAL_HORIZONTAL_POSITION,
    INITIAL_VERTICAL_POSITION,
    applyCustomSegmentDistances,
    updateCyOverviewDimensions,
    renderEdgeBoxesWrapper,
    calculateLevelSpacingAdjustments,
    LAYOUT_TYPE,
  );
}

function applyLayout(cy) {
  const compactLayoutContainer = document.getElementById('compact-layout-container');
  const biofabricLayoutContainer = document.getElementById('biofabric-layout-container');
  const cyContainer = document.getElementById('cy-overview');

  if (LAYOUT_TYPE === LAYOUT_TYPES.BIOFABRIC) {
    // Show biofabric layout, hide compact layout
    if (compactLayoutContainer) {
      compactLayoutContainer.style.display = 'none';
    }
    if (biofabricLayoutContainer) {
      biofabricLayoutContainer.style.display = 'flex';
    }
    if (cyContainer) {
      cyContainer.style.display = 'none';
    }

    applyBioFabricLayout(
      graphDataStore,
      socket,
    );
  } else {
    // Show compact layout, hide biofabric layout
    if (compactLayoutContainer) {
      compactLayoutContainer.style.display = 'block';
    }
    if (biofabricLayoutContainer) {
      biofabricLayoutContainer.style.display = 'none';
    }
    if (cyContainer) {
      cyContainer.style.display = 'block';
      cyContainer.style.pointerEvents = 'auto';
      cyContainer.style.opacity = '1';
    }

    // Remove intermediate nodes and edges from bio fabric layout if any
    const intermediateNodes = cy.nodes('[isBioFabricIntermediate = "true"]');
    const intermediateEdges = cy.edges('[isBioFabricEdge = "true"]');
    cy.remove(intermediateNodes);
    cy.remove(intermediateEdges);

    // Restore original edges visibility
    cy.edges('[isBioFabricEdge != "true"]').style('display', 'element');

    applyCompactLayoutWrapper(cy);
  }
}

var isInitialized = false;
var cy2 = null;

const $ = document.querySelector.bind(document);
const $overview_graph_config = $('#overview-graph-config');

/**
 * Setup sidebar toggle functionality with icon-only collapsed state
 */
function setupSidebarToggle() {
  const toggleButton = document.getElementById('overview-config-toggle');
  const body = document.body;
  const configSidebar = document.getElementById('config');
  
  if (!toggleButton || !configSidebar) {
    console.warn('Sidebar toggle elements not found');
    return;
  }

  // Toggle functionality
  toggleButton.addEventListener('click', () => {
    body.classList.toggle('overview-config-collapsed');
    configSidebar.classList.toggle('collapsed');
    
    // Update aria-label for accessibility
    const isCollapsed = body.classList.contains('overview-config-collapsed');
    toggleButton.setAttribute('title', isCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar');
  });
}

window.addEventListener('load', () => {
  makeOverviewSettings();

  // Setup sidebar toggle functionality
  setupSidebarToggle();

  // Initialize compact layout container
  const compactLayoutContainer = document.getElementById('compact-layout-container');
  if (compactLayoutContainer) {
    // Create cy-overview if it doesn't exist
    if (!document.getElementById('cy-overview')) {
      const cyOverview = h('div', { id: 'cy-overview' }, []);
      compactLayoutContainer.appendChild(cyOverview);
    }
    // Create edge-boxes-container if it doesn't exist
    if (!document.getElementById('edge-boxes-container')) {
      const edgeBoxesContainer = h('div', {
        id: 'edge-boxes-container',
        class: 'edge-boxes-container',
      }, []);
      compactLayoutContainer.appendChild(edgeBoxesContainer);
    }
  }

  // Initialize biofabric layout container
  const biofabricLayoutContainer = document.getElementById('biofabric-layout-container');
  const graphPanel = document.getElementById('biofabric-graph-panel');
  const edgeBoxesPanel = document.getElementById('biofabric-edge-boxes-panel');

  if (biofabricLayoutContainer && graphPanel && edgeBoxesPanel) {
    // Create d3-biofabric-container if it doesn't exist
    if (!document.getElementById('d3-biofabric-container')) {
      const d3Container = h('div', { id: 'd3-biofabric-container' }, []);
      graphPanel.appendChild(d3Container);
    }
    // Create biofabric-edge-boxes-container if it doesn't exist
    if (!document.getElementById('biofabric-edge-boxes-container')) {
      const biofabricEdgeBoxes = h('div', {
        id: 'biofabric-edge-boxes-container',
        class: 'edge-boxes-container',
      }, []);
      edgeBoxesPanel.appendChild(biofabricEdgeBoxes);
    }
  }

  // Add click listener to clear selection when clicking outside boxes
  const edgeBoxesContainer = document.getElementById('edge-boxes-container');
  if (compactLayoutContainer && edgeBoxesContainer) {
    compactLayoutContainer.addEventListener('click', (e) => {
      // Only clear if clicking directly on the container, not on a box
      if (e.target === edgeBoxesContainer || e.target === compactLayoutContainer) {
        clearSelection(cy2);
      }
    });
  }

  // Initialize Cytoscape after elements are created
  const cyOverviewElement = document.getElementById('cy-overview');
  if (!cyOverviewElement) {
    console.error('cy-overview element not found');
    return;
  }

  cy2 = cytoscape({
    container: cyOverviewElement,
    style: overviewStylesheet,
    layout: {
      name: 'preset',
    },
    userPanningEnabled: false,
    userZoomingEnabled: false,
    boxSelectionEnabled: false,
    selectionType: 'single', // Use Shift key for multi-select
    autoungrabify: true,
    zoom: 1,
    minZoom: 1,
    maxZoom: 1,
  });

  cy2.ready(() => {
    bindListeners(cy2);

    let positionUpdateTimeout;
    cy2.on('position', 'node', () => {
      clearTimeout(positionUpdateTimeout);
      positionUpdateTimeout = setTimeout(() => {
        applyCustomSegmentDistances(cy2);
      }, 10);
    });
    window.addEventListener('resize', () => {
      applyCustomSegmentDistances(cy2);
      updateCyOverviewDimensions(cy2, LAYOUT_DIRECTION);
      renderEdgeBoxesWrapper(cy2);
    });

    // Apply initial layout (important for biofabric layout initialization)
    applyLayout(cy2);

    // Initial render of edge boxes
    renderEdgeBoxesWrapper(cy2);

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
      cy2.nodes().style('opacity', 1);
      cy2.edges().style('opacity', 1);
    });

    cy2.on('mouseover', 'edge', (evt) => {
      const hoveredEdge = evt.target;
      const edgeId = hoveredEdge.id();
      const selectedEdgeId = graphDataStore.getSelectedEdgeId();
      if (selectedEdgeId !== edgeId) {
        const correspondingBox = findEdgeBox(edgeId);
        if (correspondingBox) {
          correspondingBox.classList.add('edge-box-highlighted');
          hoveredEdge.addClass('edge-highlighted');
        }
      }
    });

    cy2.on('mouseout', 'edge', (evt) => {
      const hoveredEdge = evt.target;
      const edgeId = hoveredEdge.id();
      const selectedEdgeId = graphDataStore.getSelectedEdgeId();
      if (selectedEdgeId !== edgeId) {
        const correspondingBox = findEdgeBox(edgeId);
        if (correspondingBox) {
          correspondingBox.classList.remove('edge-box-highlighted');
          hoveredEdge.removeClass('edge-highlighted');
        }
      }
    });

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
});

socket.on('pane added', (data) => {
  onPaneAdded(data);

  if (data.id === 'pane-0' && !isInitialized) {
    isInitialized = true;
  }
});

// Remove panes from overview only when manually removed by user
// Keep them visible if destroyed due to max limit (so they can be restored)
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
        // Generate unique edge ID to support multiple merges of the same nodes
        let edgeId = spawnerId + paneId;
        let counter = 1;
        // Check if edge with this ID already exists, if so, make it unique
        while (graphDataStore.getEdge(edgeId) !== null) {
          edgeId = `${spawnerId}-${paneId}-merge-${counter}`;
          counter += 1;
        }
        spawner.push({
          id: edgeId,
          source: spawnerId,
          target: paneId,
          label: 'merged',
          classes: 'merge-edge',
        });
      });
    } else if (newPaneData.spawner) {
      // Handle single spawner
      let edgeId = spawnerNodes?.join(', ') + paneId;
      let counter = 1;
      // Check if edge with this ID already exists, if so, make it unique
      while (graphDataStore.getEdge(edgeId) !== null) {
        edgeId = `${spawnerNodes?.join(', ')}-${paneId}-${counter}`;
        counter += 1;
      }
      spawner.push({
        id: edgeId,
        source: newPaneData.spawner,
        target: paneId,
        label: isDuplicate
          ? 'DUPL-' + spawnerNodes?.join(', ')
          : spawnerNodes?.join(', '),
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
      const parentNode = graphDataStore.getNode(spawnerId);
      if (parentNode) {
        const parentLevel = parentNode.level || 0;
        maxParentLevel = Math.max(maxParentLevel, parentLevel);
      }
    });

    if (maxParentLevel >= 0) {
      level = maxParentLevel + 1;
    }
  }

  const nodesAtLevel = graphDataStore.filterNodes(n => n.level === level);
  const itemValue = nodesAtLevel.length + 1;

  let initialPosition = { x: 0, y: 0 };

  if (LAYOUT_DIRECTION === LAYOUT_DIRECTIONS.HORIZONTAL) {
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

  // Add node to data store first
  graphDataStore.addNode(paneId, {
    id: paneId,
    label: paneId,
    level: level,
    item: itemValue,
    position: initialPosition,
    style: {
      opacity: 0.3,
      shape: 'rectangle',
    },
  });

  // Add edges to data store
  spawner.forEach(edgeData => {
    graphDataStore.addEdge(edgeData.id, edgeData);
  });

  // Sync to Cytoscape for rendering
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
    edges: spawner.map(edgeData => ({
      data: {
        id: edgeData.id,
        source: edgeData.source,
        target: edgeData.target,
        label: edgeData.label,
      },
      classes: edgeData.classes,
    })),
  };

  cy2.add(elements);

  // Apply edge segments immediately after adding elements to prevent flash
  spawner.forEach(edgeData => {
    if (edgeData.source && edgeData.target) {
      const sourceNode = cy2.getElementById(edgeData.source);
      const targetNode = cy2.getElementById(edgeData.target);
      const edge = cy2.getElementById(edgeData.id);

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
    updateCyOverviewDimensions(cy2, LAYOUT_DIRECTION);
  }, 10);

  // Apply layout after elements are added (for edge positioning and other adjustments)
  setTimeout(() => {
    applyLayout(cy2);
    if (LAYOUT_TYPE === LAYOUT_TYPES.COMPACT) {
      renderEdgeBoxesWrapper(cy2);
    }
  }, 50);
}

function removeNode(id) {
  const nodeIdToRemove = id;

  // Remove associated edges and their notes from data store
  const edgesToRemove = graphDataStore.getEdgesForNode(nodeIdToRemove);
  edgesToRemove.forEach(edge => {
    graphDataStore.removeEdge(edge.id);
  });

  // Remove from Cytoscape
  const cyEdgesToRemove = cy2.edges(`[source="${nodeIdToRemove}"], [target="${nodeIdToRemove}"]`);
  cyEdgesToRemove.remove();

  // Remove node from data store
  graphDataStore.removeNode(nodeIdToRemove);

  // Remove node from Cytoscape
  cy2.remove('#' + nodeIdToRemove);

  // Update edge boxes after removal
  renderEdgeBoxesWrapper(cy2);
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

  // Create collapsed state buttons (icon-only versions)
  const $collapsedButtonExpand = h(
    'button',
    { class: 'ui button icon-only-button', title: 'Expand' },
    [h('i', { class: 'fa-solid fa-expand' }, [])],
  );
  const $collapsedButtonCollapse = h(
    'button',
    { class: 'ui button icon-only-button', title: 'Collapse' },
    [h('i', { class: 'fa-solid fa-compress' }, [])],
  );
  const $collapsedButtonMerge = h(
    'button',
    { class: 'ui button icon-only-button', title: 'Merge' },
    [h('i', { class: 'fa-solid fa-object-group' }, [])],
  );
  const $collapsedButtonRemove = h(
    'button',
    { class: 'ui button icon-only-button', title: 'Remove' },
    [h('i', { class: 'fa-solid fa-trash' }, [])],
  );
  const $collapsedButtonDuplicate = h(
    'button',
    { class: 'ui button icon-only-button', title: 'Duplicate' },
    [h('i', { class: 'fa-solid fa-copy' }, [])],
  );
  const $collapsedButtonExport = h(
    'button',
    { class: 'ui button icon-only-button', title: 'Export' },
    [h('i', { class: 'fa-solid fa-download' }, [])],
  );

  // Layout Type Configuration
  const $layoutTypeLabel = h('label', { class: 'label label-info' }, [t('Layout Type')]);

  // Radio button for compact layout
  const $compactRadio = h('input', {
    type: 'radio',
    id: 'layout-compact',
    name: 'layout-type',
    value: LAYOUT_TYPES.COMPACT,
    checked: LAYOUT_TYPE === LAYOUT_TYPES.COMPACT,
  }, []);
  const $compactLabel = h('label', { for: 'layout-compact', class: 'radio-label' }, [t('Compact')]);
  const $compactContainer = h('div', { class: 'radio-option' }, [$compactRadio, $compactLabel]);

  // Radio button for bio fabric layout
  const $biofabricRadio = h('input', {
    type: 'radio',
    id: 'layout-biofabric',
    name: 'layout-type',
    value: LAYOUT_TYPES.BIOFABRIC,
    checked: LAYOUT_TYPE === LAYOUT_TYPES.BIOFABRIC,
  }, []);
  const $biofabricLabel = h('label', { for: 'layout-biofabric', class: 'radio-label' }, [t('Bio Fabric')]);
  const $biofabricContainer = h('div', { class: 'radio-option' }, [$biofabricRadio, $biofabricLabel]);

  const $layoutTypeContainer = h('div', { class: 'radio-group' }, [$biofabricContainer, $compactContainer]);

  // Layout Direction Configuration
  const $layoutDirectionLabel = h('label', { class: 'label label-info' }, [t('Layout Direction')]);

  // Radio button for horizontal layout
  const $horizontalRadio = h('input', {
    type: 'radio',
    id: 'layout-horizontal',
    name: 'layout-direction',
    value: LAYOUT_DIRECTIONS.HORIZONTAL,
    checked: LAYOUT_DIRECTION === LAYOUT_DIRECTIONS.HORIZONTAL,
  }, []);
  const $horizontalLabel = h('label', { for: 'layout-horizontal', class: 'radio-label' }, [t('Horizontal')]);
  const $horizontalContainer = h('div', { class: 'radio-option' }, [$horizontalRadio, $horizontalLabel]);

  // Radio button for vertical layout
  const $verticalRadio = h('input', {
    type: 'radio',
    id: 'layout-vertical',
    name: 'layout-direction',
    value: LAYOUT_DIRECTIONS.VERTICAL,
    checked: LAYOUT_DIRECTION === LAYOUT_DIRECTIONS.VERTICAL,
  }, []);
  const $verticalLabel = h('label', { for: 'layout-vertical', class: 'radio-label' }, [t('Vertical')]);
  const $verticalContainer = h('div', { class: 'radio-option' }, [$verticalRadio, $verticalLabel]);

  const $layoutDirectionContainer = h('div', { class: 'radio-group' }, [$horizontalContainer, $verticalContainer]);

  // Explicitly set the correct radio buttons as checked after DOM creation
  setTimeout(() => {
    if (LAYOUT_TYPE === LAYOUT_TYPES.COMPACT) {
      $compactRadio.checked = true;
      $biofabricRadio.checked = false;
    } else {
      $compactRadio.checked = false;
      $biofabricRadio.checked = true;
    }
    if (LAYOUT_DIRECTION === LAYOUT_DIRECTIONS.HORIZONTAL) {
      $horizontalRadio.checked = true;
      $verticalRadio.checked = false;
    } else {
      $horizontalRadio.checked = false;
      $verticalRadio.checked = true;
    }
  }, 0);

  // Helper function to ensure selection is emitted before action
  const ensureSelectionEmitted = () => {
    let finalSelectedIDs = [];

    if (LAYOUT_TYPE === LAYOUT_TYPES.BIOFABRIC) {
      // For biofabric layout, get selection from data store
      finalSelectedIDs = graphDataStore.getSelectedNodeIds();
    } else {
      // For compact layout, get selection from Cytoscape
      const selectedNodes = cy2.$('node:selected');
      const selectedNodeIDs = selectedNodes.map((node) => node.id());

      // Also check all nodes to see if any have the selected class
      const allNodes = cy2.nodes();
      const nodesWithSelectedClass = [];
      allNodes.forEach(n => {
        if (n.hasClass('selected')) {
          nodesWithSelectedClass.push(n.id());
        }
      });

      // If query didn't find nodes but manual check did, use manual check
      finalSelectedIDs = selectedNodeIDs.length > 0 ? selectedNodeIDs : nodesWithSelectedClass;

      // Also trigger the select event to ensure any listeners are notified
      cy2.trigger('select');
    }

    // Always emit immediately, even if empty, to ensure backend state is synchronized
    // This is critical for biofabric layout where selection might not be emitted on click
    socket.emit('overview nodes selected', finalSelectedIDs);
  };

  $buttonMerge.addEventListener('click', async () => {
    ensureSelectionEmitted();
    socket.emit('handle selection', 'merge');
  });
  $buttonRemove.addEventListener('click', async () => {
    ensureSelectionEmitted();
    socket.emit('handle selection', 'delete');
  });
  $buttonDuplicate.addEventListener('click', async () => {
    ensureSelectionEmitted();
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

  // Add event listeners for collapsed buttons (same functionality as regular buttons)
  $collapsedButtonExpand.addEventListener('click', async () => {
    socket.emit('handle selection', 'expand');
  });
  $collapsedButtonCollapse.addEventListener('click', async () => {
    socket.emit('handle selection', 'collapse');
  });
  $collapsedButtonMerge.addEventListener('click', async () => {
    ensureSelectionEmitted();
    socket.emit('handle selection', 'merge');
  });
  $collapsedButtonRemove.addEventListener('click', async () => {
    ensureSelectionEmitted();
    socket.emit('handle selection', 'delete');
  });
  $collapsedButtonDuplicate.addEventListener('click', async () => {
    ensureSelectionEmitted();
    socket.emit('handle selection', 'duplicate');
  });
  $collapsedButtonExport.addEventListener('click', async () => {
    socket.emit('handle selection', 'export');
  });

  // Add layout type configuration
  const $layoutTypeConfig = h('div', { class: 'param' }, []);
  $layoutTypeConfig.appendChild($layoutTypeLabel);
  $layoutTypeConfig.appendChild($layoutTypeContainer);

  // Add layout direction configuration
  const $layoutDirectionConfig = h('div', { class: 'param' }, []);
  $layoutDirectionConfig.appendChild($layoutDirectionLabel);
  $layoutDirectionConfig.appendChild($layoutDirectionContainer);

  // Function to show/hide layout direction based on layout type
  const updateLayoutDirectionVisibility = () => {
    if (LAYOUT_TYPE === LAYOUT_TYPES.BIOFABRIC) {
      $layoutDirectionConfig.style.display = 'none';
    } else {
      $layoutDirectionConfig.style.display = '';
    }
  };

  // Set initial visibility based on current layout type
  updateLayoutDirectionVisibility();

  // Layout Type radio button event listeners
  $compactRadio.addEventListener('change', (e) => {
    if (e.target.checked) {
      LAYOUT_TYPE = LAYOUT_TYPES.COMPACT;
      updateLayoutDirectionVisibility();
      // Reapply layout
      applyLayout(cy2);
    }
  });

  $biofabricRadio.addEventListener('change', (e) => {
    if (e.target.checked) {
      LAYOUT_TYPE = LAYOUT_TYPES.BIOFABRIC;
      updateLayoutDirectionVisibility();
      // Reapply layout
      applyLayout(cy2);
    }
  });

  // Layout Direction radio button event listeners
  $verticalRadio.addEventListener('change', (e) => {
    if (e.target.checked) {
      LAYOUT_DIRECTION = LAYOUT_DIRECTIONS.VERTICAL;
      // Reapply layout with new direction
      applyLayout(cy2);
      if (LAYOUT_TYPE === LAYOUT_TYPES.COMPACT) {
        renderEdgeBoxesWrapper(cy2);
      }
    }
  });

  $horizontalRadio.addEventListener('change', (e) => {
    if (e.target.checked) {
      LAYOUT_DIRECTION = LAYOUT_DIRECTIONS.HORIZONTAL;
      // Reapply layout with new direction
      applyLayout(cy2);
      if (LAYOUT_TYPE === LAYOUT_TYPES.COMPACT) {
        renderEdgeBoxesWrapper(cy2);
      }
    }
  });

  $buttons.appendChild($buttonMerge);
  $buttons.appendChild($buttonRemove);
  $buttons2.appendChild($buttonDuplicate);
  $buttons2.appendChild($buttonExport);
  $buttons3.appendChild($buttonExpand);
  $buttons3.appendChild($buttonCollapse);

  // Create normal content container
  const $normalContent = h('div', { class: 'overview-config-normal-content' }, [
    $buttons3,
    $buttons,
    $buttons2,
    $layoutTypeConfig,
    $layoutDirectionConfig,
  ]);

  // Create collapsed content container with icon-only buttons (one per row)
  const $collapsedContent = h('div', { class: 'overview-config-collapsed-content' }, [
    h('div', { class: 'collapsed-button-row' }, [$collapsedButtonExpand]),
    h('div', { class: 'collapsed-button-row' }, [$collapsedButtonCollapse]),
    h('div', { class: 'collapsed-button-row' }, [$collapsedButtonMerge]),
    h('div', { class: 'collapsed-button-row' }, [$collapsedButtonRemove]),
    h('div', { class: 'collapsed-button-row' }, [$collapsedButtonDuplicate]),
    h('div', { class: 'collapsed-button-row' }, [$collapsedButtonExport]),
  ]);

  // Add both content containers to the config section
  $overview_graph_config?.appendChild($normalContent);
  $overview_graph_config?.appendChild($collapsedContent);
}
