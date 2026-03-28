import { cytoscape } from './imports/import-cytoscape.js';
import { COLORS, OUTLINES } from '../style/views/variables.js';

// Axiom states
export const AXIOM_STATES = {
  KEPT: 'kept',      // Green
  REMOVED: 'removed', // Red
  UNDECIDED: 'undecided', // Gray
};

// Store axiom states per pane
const axiomStates = new Map();
let activeSummaryCy = null;
let summaryKeyboardBound = false;

function bindSummaryKeyboardShortcuts() {
  if (summaryKeyboardBound) {
    return;
  }

  document.addEventListener('keydown', (event) => {
    if (!activeSummaryCy || !activeSummaryCy.container() || event.defaultPrevented) {
      return;
    }

    const activeTag = document.activeElement?.tagName;
    if (activeTag === 'INPUT' || activeTag === 'TEXTAREA') {
      return;
    }

    const selectedNodes = activeSummaryCy.$('node:selected');
    if (selectedNodes.length === 0) {
      return;
    }

    const key = event.key?.toLowerCase();
    let nextState = null;

    if (key === 'k') {
      nextState = AXIOM_STATES.KEPT;
    } else if (key === 'r') {
      nextState = AXIOM_STATES.REMOVED;
    } else if (key === 'u') {
      nextState = AXIOM_STATES.UNDECIDED;
    }

    if (!nextState) {
      return;
    }

    event.preventDefault();
    const node = selectedNodes[0];
    setAxiomState(activeSummaryCy.paneId, node.id(), nextState, activeSummaryCy);
  });

  summaryKeyboardBound = true;
}

/**
 * Get representative axiom for each depth level
 */
function getAxiomsByDepth(treeData) {
  if (!treeData || !treeData.nodes) {
    return {};
  }

  const axiomsByDepth = {};

  // Calculate depth for each node
  const nodeDepths = new Map();
  const targetIds = new Set(treeData.edges.map(e => e.target));
  
  // Find root nodes (no incoming edges)
  const rootNodes = treeData.nodes.filter(node => !targetIds.has(node.id));
  
  // BFS to calculate depths
  const queue = [];
  rootNodes.forEach(node => {
    nodeDepths.set(node.id, 0);
    queue.push(node.id);
  });

  while (queue.length > 0) {
    const currentId = queue.shift();
    const currentDepth = nodeDepths.get(currentId);
    
    // Find all children of current node
    const childEdges = treeData.edges.filter(edge => edge.source === currentId);
    childEdges.forEach(edge => {
      if (!nodeDepths.has(edge.target)) {
        nodeDepths.set(edge.target, currentDepth + 1);
        queue.push(edge.target);
      }
    });
  }

  const depthValues = Array.from(nodeDepths.values());
  const maxDepth = depthValues.length > 0 ? Math.max(...depthValues) : 0;

  // Group by depth and select first axiom as representative
  treeData.nodes.forEach(node => {
    const depth = nodeDepths.get(node.id) || 0;
    if (depth >= maxDepth) {
      return;
    }
    // Only store the first axiom for each depth (representative)
    if (!axiomsByDepth[depth]) {
      axiomsByDepth[depth] = {
        id: node.id,
        nodeId: node.nodeId,
        label: node.label || node.axiom || `Node ${node.nodeId}`,
        depth,
      };
    }
  });

  return axiomsByDepth;
}

/**
 * Create stylesheet for axiom pane
 */
function createAxiomPaneStylesheet() {
  return [
    {
      selector: 'core',
      style: {
        'selection-box-opacity': 0,
        'active-bg-opacity': 0,
      },
    },
    {
      selector: 'node',
      style: {
        label: 'data(label)',
        shape: 'rectangle',
        width: 200,
        height: 'label',
        padding: '8px',
        'font-size': 10,
        'font-family': 'monospace',
        'text-valign': 'center',
        'text-margin-y': '0.65px',
        'text-halign': 'center',
        'text-wrap': 'wrap',
        'text-max-width': '200px',
        color: COLORS.LIGHT_TEXT,
        'text-outline-color': COLORS.NODE_COLOR,
        'text-outline-width': '2px',
        'border-width': OUTLINES.width,
        'border-color': COLORS.NODE_COLOR,
        'background-color': COLORS.NODE_COLOR,
        'overlay-padding': '6px',
        'z-index': '10',
        'background-opacity': 1,
        'text-outline-opacity': 0,
      },
    },
    {
      selector: 'node.kept',
      style: {
        'background-color': '#f5fff5',
        color: '#2b8a3e',
        'border-color': '#d9e8d9',
        'text-outline-color': '#f5fff5',
      },
    },
    {
      selector: 'node.removed',
      style: {
        'background-color': '#fff5f5',
        color: '#c92a2a',
        'border-color': '#f0d6d6',
        'text-outline-color': '#fff5f5',
      },
    },
    {
      selector: 'node.undecided',
      style: {
        'background-color': '#fafafa',
        color: '#555',
        'border-color': '#d9d9d9',
        'text-outline-color': '#fafafa',
      },
    },
    {
      selector: 'node:selected',
      style: {
        'border-color': COLORS.SELECTED_BORDER,
        'border-width': OUTLINES.width_selected,
        'border-style': 'double',
        'border-position': 'center',
      },
    },
    {
      selector: 'edge',
      style: {
        'display': 'none', // Hide edges in axiom pane
      },
    },
  ];
}

/**
 * Initialize axiom states for a pane
 */
function initializeAxiomStates(paneId, treeData) {
  if (!axiomStates.has(paneId)) {
    const states = {};
    if (treeData && treeData.nodes) {
      treeData.nodes.forEach(node => {
        states[node.id] = AXIOM_STATES.UNDECIDED;
      });
    }
    axiomStates.set(paneId, states);
  }
  return axiomStates.get(paneId);
}

/**
 * Get axiom state
 */
function getAxiomState(paneId, nodeId) {
  const states = axiomStates.get(paneId);
  return states ? states[nodeId] : AXIOM_STATES.UNDECIDED;
}

/**
 * Set axiom state and update visualization
 */
function setAxiomState(paneId, nodeId, state, cy) {
  const states = axiomStates.get(paneId);
  if (!states) return;

  states[nodeId] = state;
  
  // Update UI if cy is provided
  if (cy) {
    const node = cy.getElementById(nodeId);
    if (node.length > 0) {
      node.removeClass('kept removed undecided');
      node.addClass(state);
      
      // Dispatch state change event
      document.dispatchEvent(new CustomEvent('axiom-state-changed', {
        detail: { paneId, nodeId, state },
      }));
    }
  }
}

/**
 * Create axiom pane visualization
 */
export function createAxiomPane(container, treeData, paneId) {
  if (!container || !treeData) {
    console.error('Container or tree data not provided for axiom pane');
    return null;
  }

  // Initialize axiom states
  initializeAxiomStates(paneId, treeData);

  // Get axioms organized by depth
  const axiomsByDepth = getAxiomsByDepth(treeData);
  
  // Create elements for visualization - vertical layout
  const elements = [];
  const verticalSpacing = 100;

  Object.keys(axiomsByDepth)
    .map(Number)
    .sort((a, b) => a - b)
    .forEach(depth => {
      const axiom = axiomsByDepth[depth];
      
      elements.push({
        data: {
          id: axiom.id,
          label: axiom.label,
          nodeId: axiom.nodeId,
          depth: depth,
          fullLabel: axiom.label,
        },
        position: {
          x: 0,
          y: depth * verticalSpacing,
        },
        classes: AXIOM_STATES.UNDECIDED,
      });
    });

  // Create Cytoscape instance
  const cy = cytoscape({
    container,
    elements,
    style: createAxiomPaneStylesheet(),
    layout: {
      name: 'preset',
      animate: false,
    },
    zoom: 0.9,
    pan: { x: 0, y: 50 },
    minZoom: 0.1,
    maxZoom: 3,
    wheelSensitivity: 0.05,
  });

  // Store pane ID
  cy.paneId = paneId;

  bindSummaryKeyboardShortcuts();

  cy.on('tap', () => {
    activeSummaryCy = cy;
  });

  cy.on('select', 'node', () => {
    activeSummaryCy = cy;
  });

  cy.on('destroy', () => {
    if (activeSummaryCy === cy) {
      activeSummaryCy = null;
    }
  });

  // Add context menu for state changes
  if (cy.contextMenus) {
    cy.ctxmenu = cy.contextMenus({
      menuItems: [
        {
          id: 'keep-axiom',
          content: 'Keep',
          tooltipText: 'Mark this axiom as kept',
          selector: 'node',
          onClickFunction: (event) => {
            const node = event.target || event.cyTarget;
            const nodeId = node.id();
            setAxiomState(paneId, nodeId, AXIOM_STATES.KEPT, cy);
          },
          hasTrailingDivider: false,
        },
        {
          id: 'remove-axiom',
          content: 'Remove',
          tooltipText: 'Mark this axiom as removed',
          selector: 'node',
          onClickFunction: (event) => {
            const node = event.target || event.cyTarget;
            const nodeId = node.id();
            setAxiomState(paneId, nodeId, AXIOM_STATES.REMOVED, cy);
          },
          hasTrailingDivider: false,
        },
        {
          id: 'undecided-axiom',
          content: 'Undecided',
          tooltipText: 'Mark this axiom as undecided',
          selector: 'node',
          onClickFunction: (event) => {
            const node = event.target || event.cyTarget;
            const nodeId = node.id();
            setAxiomState(paneId, nodeId, AXIOM_STATES.UNDECIDED, cy);
          },
          hasTrailingDivider: true,
        },
        {
          id: 'fit-view',
          content: 'Fit to view',
          tooltipText: 'Fit axiom pane to viewport',
          coreAsWell: true,
          onClickFunction: () => {
            cy.fit(undefined, 30);
          },
          hasTrailingDivider: false,
        },
        {
          id: 'expand-tree-by-summary',
          content: 'Apply to Tree',
          tooltipText: 'Expand the decision tree according to keep/remove decisions in Summary View',
          coreAsWell: true,
          onClickFunction: () => {
            document.dispatchEvent(new CustomEvent('summary-view-expand-decision-tree', {
              detail: { paneId },
            }));
          },
          hasTrailingDivider: false,
        },
      ],
    });
  }

  // Axiom pane operates independently - no synchronization with decision tree

  // Fit to view initially
  setTimeout(() => {
    cy.fit(undefined, 30);
  }, 100);

  return cy;
}

/**
 * Get all axiom states for a pane
 */
export function getAxiomStatesForPane(paneId) {
  return axiomStates.get(paneId) || {};
}

/**
 * Clear axiom states for a pane
 */
export function clearAxiomStatesForPane(paneId) {
  axiomStates.delete(paneId);
}

export function setSummaryNodeState(cy, paneId, nodeId, state) {
  if (!cy || !nodeId || !state) {
    return;
  }
  setAxiomState(paneId, nodeId, state, cy);
}

export function setSummaryStateByDepth(cy, paneId, depth, state) {
  if (!cy || depth === undefined || depth === null || !state) {
    return;
  }
  const depthNode = cy.nodes().find(n => n.data('depth') === depth);
  if (depthNode && depthNode.length > 0) {
    setAxiomState(paneId, depthNode.id(), state, cy);
  }
}

export function resetSummaryStates(cy, paneId) {
  if (!cy) {
    return;
  }
  cy.nodes().forEach(node => {
    setAxiomState(paneId, node.id(), AXIOM_STATES.UNDECIDED, cy);
  });
}

/**
 * Update axiom pane with new tree data
 */
export function updateAxiomPane(cy, treeData, paneId) {
  if (!cy || !treeData) return;

  // Reinitialize axiom states
  initializeAxiomStates(paneId, treeData);

  // Remove all elements
  cy.elements().remove();

  // Get axioms organized by depth
  const axiomsByDepth = getAxiomsByDepth(treeData);
  const elements = [];
  const verticalSpacing = 100;

  Object.keys(axiomsByDepth)
    .map(Number)
    .sort((a, b) => a - b)
    .forEach(depth => {
      const axiom = axiomsByDepth[depth];

      elements.push({
        data: {
          id: axiom.id,
          label: axiom.label,
          nodeId: axiom.nodeId,
          depth: depth,
          fullLabel: axiom.label,
        },
        position: {
          x: 0,
          y: depth * verticalSpacing,
        },
        classes: AXIOM_STATES.UNDECIDED,
      });
    });

  cy.add(elements);

  // Reset zoom and pan
  cy.zoom(0.9);
  cy.pan({ x: 0, y: 50 });
  setTimeout(() => {
    cy.fit(undefined, 30);
  }, 100);
}

export default {
  createAxiomPane,
  updateAxiomPane,
  getAxiomStatesForPane,
  clearAxiomStatesForPane,
  setSummaryNodeState,
  setSummaryStateByDepth,
  resetSummaryStates,
  AXIOM_STATES,
};
