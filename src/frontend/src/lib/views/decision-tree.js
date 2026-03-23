import { cytoscape } from './imports/import-cytoscape.js';
import { COLORS, OUTLINES } from '../style/views/variables.js';
import { spawnPane, getPanes } from './panes/panes.js';
import { CONSTANTS } from '../utils/names.js';

let activeDecisionTreeCy = null;

/**
 * Fit all panes to view after a layout animation
 */
function fitAllPanesAfterLayout(delayMs = 300) {
  setTimeout(() => {
    const panes = getPanes();
    Object.values(panes).forEach(pane => {
      if (pane.cy) {
        pane.cy.fit(undefined, 30);
      }
    });
  }, delayMs);
}

function dispatchPaneDataChanged(cy) {
  if (!cy || !cy.paneId) {
    return;
  }
  document.dispatchEvent(new CustomEvent('decision-tree-pane-data-changed', {
    detail: { paneId: cy.paneId },
  }));
}

/**
 * Create stylesheet for decision tree visualization
 * Using PRISM model checker style
 */
function createDecisionTreeStylesheet() {
  return [
    {
      selector: 'core',
      style: {
        'selection-box-color': COLORS.SELECTED_NODE_COLOR,
        'selection-box-border-color': '#8BB0D0',
        'selection-box-opacity': '0.5',
        'active-bg-opacity': 0,
      },
    },
    {
      selector: 'node, edge',
      style: {
        'overlay-opacity': 0,
      },
    },
    {
      selector: 'node.s',
      style: {
        label: 'data(label)',
        color: COLORS.LIGHT_TEXT,
        shape: 'rectangle',
        width: 'label',
        height: 'label',
        padding: '8px',
        'font-size': 10,
        'font-family': 'monospace',
        'text-valign': 'center',
        'text-margin-y': '0.65px',
        'text-halign': 'center',
        'text-wrap': 'wrap',
        'text-max-width': '200px',
        'background-color': COLORS.NODE_COLOR,
        'text-outline-color': COLORS.NODE_COLOR,
        'text-outline-width': '2px',
        'overlay-padding': '6px',
        'z-index': '10',
        'background-opacity': 1,
        'border-width': OUTLINES.width,
        'border-color': COLORS.NODE_COLOR,
        'text-outline-opacity': 0,
      },
    },
    {
      selector: 'node.s:selected',
      style: {
        'border-color': COLORS.SELECTED_BORDER,
        'border-width': OUTLINES.width_selected,
        'border-style': 'double',
        'border-position': 'center',
      },
    },
    {
      selector: 'node.starplot-hovered',
      style: {
        'border-color': '#facc15',
        'border-width': Math.max(OUTLINES.width_selected, 4),
        'border-style': 'double',
      },
    },
    {
      selector: 'node.s.has-children',
      style: {
        // Unexpanded nodes - solid background
        'background-opacity': 1,
      },
    },
    {
      selector: 'node.s.expanded',
      style: {
        // Expanded nodes - hollow with just border
        'background-opacity': 0,
        color: COLORS.DARK_TEXT,
        'border-color': COLORS.NODE_COLOR,
      },
    },
    {
      selector: 'node.s.partially-expanded',
      style: {
        // Partially expanded nodes - gray fill
        'background-opacity': 1,
        'background-color': '#c6c6c6',
        color: COLORS.DARK_TEXT,
        'text-outline-color': '#c6c6c6',
        'border-color': COLORS.NODE_COLOR,
      },
    },
    {
      selector: 'node.s.expanded:selected',
      style: {
        'border-color': COLORS.SELECTED_BORDER,
        'border-width': OUTLINES.width_selected,
        'border-style': 'double',
      },
    },
    {
      selector: 'node.s.partially-expanded:selected',
      style: {
        'border-color': COLORS.SELECTED_BORDER,
        'border-width': OUTLINES.width_selected,
        'border-style': 'double',
      },
    },
    {
      selector: 'node.s.expanded.starplot-hovered',
      style: {
        'border-color': '#facc15',
        'border-width': Math.max(OUTLINES.width_selected, 4),
        'border-style': 'double',
      },
    },
    {
      selector: 'node.s.partially-expanded.starplot-hovered',
      style: {
        'border-color': '#facc15',
        'border-width': Math.max(OUTLINES.width_selected, 4),
        'border-style': 'double',
      },
    },
    {
      selector: 'node.s.leaf',
      style: {
        // Leaf nodes - empty circle or with repair status
        label: 'data(repairSymbol)',
        shape: 'ellipse',
        width: 18,
        height: 18,
        'background-opacity': 'data(symbolBackgroundOpacity)',
        'background-color': 'data(symbolBackground)',
        'border-color': 'data(symbolBorderColor)',
        'border-width': OUTLINES.width,
        'font-size': 12,
        'font-weight': 'bold',
        'text-valign': 'center',
        'text-halign': 'center',
        color: 'data(symbolColor)',
        padding: 0,
      },
    },
    {
      selector: 'node.s.leaf:selected',
      style: {
        'border-color': 'data(symbolColor)',
        'border-width': 3,
        'border-style': 'double',
      },
    },
    {
      selector: 'edge',
      style: {
        'curve-style': 'bezier',
        width: 2.5,
        'target-arrow-shape': 'triangle',
        'target-arrow-size': 15,
        'line-style': 'solid',
        'font-size': 10,
        label: 'data(label)',
        color: '#333',
        'text-outline-color': 'white',
        'text-outline-opacity': 1,
        'text-outline-width': '2px',
      },
    },
    {
      selector: 'edge[type="keep"]',
      style: {
        'line-color': '#22c55e', // Green for keep
        'target-arrow-color': '#22c55e',
      },
    },
    {
      selector: 'edge[type="remove"]',
      style: {
        'line-color': '#ef4444', // Red for remove
        'target-arrow-color': '#ef4444',
      },
    },
  ];
}

/**
 * Create and render decision tree visualization
 */
export function createDecisionTree(container, treeData, fullTreeData) {
  if (!container) {
    console.error('Container not provided for decision tree');
    return null;
  }

  // Use fullTreeData for node classification if provided, otherwise use treeData
  const classificationData = fullTreeData || treeData;

  // Convert tree data to Cytoscape format
  const elements = [];

  // Add nodes
  treeData.nodes.forEach(node => {
    elements.push({
      data: {
        id: node.id,
        label: node.label || node.axiom,
        nodeId: node.nodeId,
        axiom: node.label || node.axiom,
        repairSymbol: '',
        symbolColor: '#333',
        symbolBackground: 'transparent',
        symbolBorderColor: COLORS.NODE_COLOR,
        symbolBackgroundOpacity: 0,
      },
      classes: getNodeClasses(node.id, classificationData),
    });
  });

  // Add edges
  treeData.edges.forEach(edge => {
    elements.push({
      data: {
        id: edge.id,
        source: edge.source,
        target: edge.target,
        label: edge.label,
        type: edge.type,
      },
    });
  });

  // Create Cytoscape instance
  const cy = cytoscape({
    container,
    elements,
    style: createDecisionTreeStylesheet(),
    layout: {
      name: 'dagre',
      directed: true,
      rankDir: 'LR', // Left-to-right horizontal layout
      animate: true,
      animationDuration: 500,
    },
    zoom: 1,
    pan: { x: 0, y: 0 },
    minZoom: 0.1,
    maxZoom: 3,
    wheelSensitivity: 0.1,
  });

  // Store tree data and expanded nodes
  cy.treeData = treeData;
  cy.expandedNodes = new Map();
  cy.vars ||= {};
  cy.vars['pcp-auto-sync'] ||= { value: true };
  cy.vars['pcp-refine'] ||= { value: true };
  cy.vars['pcp-dfs'] ||= { value: false };
  cy.vars['pcp-bi'] ||= { value: 'o' };
  cy.vars['pcp-vs'] ||= { value: false };
  cy.vars['pcp-hs'] ||= { value: false };

  const dispatchNodeSelected = (nodeId) => {
    const selectedNodes = cy.$('node:selected');
    const selectedNodeIds = selectedNodes.map(n => n.data('nodeId'));
    document.dispatchEvent(new CustomEvent('decision-tree-node-selected', {
      detail: { nodeId, selectedNodeIds, paneId: cy.paneId },
    }));
  };

  const dispatchSelectionChange = () => {
    const selectedNodes = cy.$('node:selected');
    if (selectedNodes.length === 0) {
      document.dispatchEvent(new CustomEvent('decision-tree-node-selected', {
        detail: { nodeId: null, selectedNodeIds: [], paneId: cy.paneId },
      }));
      return;
    }
    const nodeId = selectedNodes[0].data('nodeId');
    const selectedNodeIds = selectedNodes.map(n => n.data('nodeId'));
    document.dispatchEvent(new CustomEvent('decision-tree-node-selected', {
      detail: { nodeId, selectedNodeIds, paneId: cy.paneId },
    }));
  };

  const dispatchNodeHovered = (nodeId = null) => {
    document.dispatchEvent(new CustomEvent('decision-tree-node-hovered', {
      detail: { nodeId, paneId: cy.paneId },
    }));
  };

  // Add interaction handlers
  cy.on('tap', 'node', (event) => {
    activeDecisionTreeCy = cy;
    const nodeId = event.target.data('nodeId');
    setTimeout(() => {
      dispatchNodeSelected(nodeId);
      dispatchSelectionChange();
    }, 0);
  });

  cy.on('select', 'node', () => {
    activeDecisionTreeCy = cy;
    dispatchSelectionChange();
  });

  cy.on('unselect', 'node', () => {
    activeDecisionTreeCy = cy;
    dispatchSelectionChange();
  });

  cy.on('mouseover', 'node', (event) => {
    activeDecisionTreeCy = cy;
    const node = event.target;
    if (!node || !node.selected()) {
      dispatchNodeHovered(null);
      return;
    }
    dispatchNodeHovered(node.data('nodeId'));
  });

  cy.on('mouseout', 'node', () => {
    activeDecisionTreeCy = cy;
    dispatchNodeHovered(null);
  });

  // Handle double-click to expand nodes
  cy.on('dbltap', 'node', (event) => {
    activeDecisionTreeCy = cy;
    const node = event.target;
    const nodeId = node.data('nodeId');
    expandNode(cy, nodeId);
  });

  // Store reference to keyboard handler for this cy instance
  const keyboardHandler = (e) => {
    // Only process if this cy instance's container is in focus or has selected nodes
    if (!cy.container() || document.activeElement.tagName === 'INPUT') {
      return;
    }

    if (activeDecisionTreeCy && activeDecisionTreeCy !== cy) {
      return;
    }
    
    const selectedNodes = cy.$('node:selected');
    if (selectedNodes.length === 0) {
      return; // This cy instance doesn't have selected nodes
    }
    
    // k/r: expand keep/remove edge in current pane
    if (e.key === 'k' || e.key === 'K') {
      if (e._dlRepairHandled) {
        return;
      }
      e.preventDefault();
      e._dlRepairHandled = true;
      expandNodeByType(cy, selectedNodes[0].data('nodeId'), 'keep');
      return;
    }

    if (e.key === 'r' || e.key === 'R') {
      if (e._dlRepairHandled) {
        return;
      }
      e.preventDefault();
      e._dlRepairHandled = true;
      expandNodeByType(cy, selectedNodes[0].data('nodeId'), 'remove');
      return;
    }

    // Cmd+Enter: expand in same pane, Ctrl+Enter: expand in new pane
    if (e.key === 'Enter' || e.keyCode === 13) {
      // Check if event was already handled by another instance
      if (e._dlRepairHandled) {
        return;
      }
      
      e.preventDefault();
      e._dlRepairHandled = true; // Mark as handled
      
      if (e.ctrlKey && !e.metaKey) {
        // Ctrl+Enter: Expand in new pane
        expandNodeInNewPane(cy, selectedNodes[0].data('nodeId'));
      } else if (e.metaKey) {
        // Cmd+Enter: Expand in same pane
        expandNode(cy, selectedNodes[0].data('nodeId'));
      }
    }

    // Arrow key navigation
    if (e.key === 'ArrowLeft') {
      if (e._dlRepairHandled) {
        return;
      }
      e.preventDefault();
      e._dlRepairHandled = true;
      // Go to parent node
      const currentNode = selectedNodes[0];
      const parentEdges = cy.treeData.edges.filter(edge => edge.target === currentNode.id());
      if (parentEdges.length > 0) {
        const parentNode = cy.getElementById(parentEdges[0].source);
        if (parentNode.length > 0) {
          currentNode.unselect();
          parentNode.select();
          dispatchNodeSelected(parentNode.data('nodeId'));
        }
      }
      return;
    }

    if (e.key === 'ArrowRight') {
      if (e._dlRepairHandled) {
        return;
      }
      e.preventDefault();
      e._dlRepairHandled = true;
      // Go to first visible child, preferring 'keep' over 'remove'
      const currentNode = selectedNodes[0];
      const childEdges = cy.treeData.edges.filter(edge => edge.source === currentNode.id());
      if (childEdges.length > 0) {
        // Find visible children
        const visibleChildren = childEdges
          .map(edge => ({ edge, node: cy.getElementById(edge.target) }))
          .filter(item => item.node.length > 0);
        
        if (visibleChildren.length > 0) {
          // Prefer 'keep' child over 'remove' child
          const keepChild = visibleChildren.find(item => item.edge.type === 'keep');
          const targetChild = keepChild || visibleChildren[0];
          
          currentNode.unselect();
          targetChild.node.select();
          dispatchNodeSelected(targetChild.node.data('nodeId'));
        }
      }
      return;
    }

    if (e.key === 'ArrowDown') {
      if (e._dlRepairHandled) {
        return;
      }
      e.preventDefault();
      e._dlRepairHandled = true;
      // Go to next sibling
      const currentNode = selectedNodes[0];
      const parentEdges = cy.treeData.edges.filter(edge => edge.target === currentNode.id());
      if (parentEdges.length > 0) {
        const parentId = parentEdges[0].source;
        const siblings = cy.treeData.edges.filter(
          edge => edge.source === parentId && edge.target !== currentNode.id(),
        );
        if (siblings.length > 0) {
          const nextSibling = cy.getElementById(siblings[0].target);
          if (nextSibling.length > 0) {
            currentNode.unselect();
            nextSibling.select();
            dispatchNodeSelected(nextSibling.data('nodeId'));
          }
        }
      }
      return;
    }

    if (e.key === 'ArrowUp') {
      if (e._dlRepairHandled) {
        return;
      }
      e.preventDefault();
      e._dlRepairHandled = true;
      // Go to previous sibling
      const currentNode = selectedNodes[0];
      const parentEdges = cy.treeData.edges.filter(edge => edge.target === currentNode.id());
      if (parentEdges.length > 0) {
        const parentId = parentEdges[0].source;
        const siblings = cy.treeData.edges.filter(
          edge => edge.source === parentId && edge.target !== currentNode.id(),
        );
        if (siblings.length > 0) {
          // Get the last sibling as previous
          const prevSibling = cy.getElementById(siblings[siblings.length - 1].target);
          if (prevSibling.length > 0) {
            currentNode.unselect();
            prevSibling.select();
            dispatchNodeSelected(prevSibling.data('nodeId'));
          }
        }
      }
      return;
    }
  };
  
  document.addEventListener('keydown', keyboardHandler);
  
  // Store handler reference for cleanup if needed
  cy.keyboardHandler = keyboardHandler;

  // Add context menu
  if (cy.contextMenus) {
    cy.ctxmenu = cy.contextMenus({
      menuItems: [
        {
          id: 'expand-same',
          content: `${CONSTANTS.INTERACTIONS.expand1.name}`,
          tooltipText: `${CONSTANTS.INTERACTIONS.expand1.description}\\t(Cmd+Enter)`,
          selector: 'node.has-children',
          onClickFunction: (event) => {
            const node = event.target || event.cyTarget;
            const nodeId = node.data('nodeId');
            expandNode(cy, nodeId);
          },
          hasTrailingDivider: false,
        },
        {
          id: 'expand-new',
          content: `${CONSTANTS.INTERACTIONS.expand1.name} on New Pane`,
          tooltipText: `${CONSTANTS.INTERACTIONS.expand1.description} on new pane\\t(Ctrl+Enter)`,
          selector: 'node:selected',
          onClickFunction: (event) => {
            const node = event.target || event.cyTarget;
            const nodeId = node.data('nodeId');
            expandNodeInNewPane(cy, nodeId);
          },
          hasTrailingDivider: true,
        },
        {
          id: 'collapse-node',
          content: 'Collapse',
          tooltipText: 'Collapse subtree',
          selector: 'node.expanded, node.partially-expanded',
          onClickFunction: (event) => {
            const node = event.target || event.cyTarget;
            const nodeId = node.data('nodeId');
            collapseNode(cy, nodeId);
          },
          hasTrailingDivider: true,
        },
        {
          id: 'move-path-to-summary',
          content: 'Move this path to Summary View',
          tooltipText: 'Update summary-view node states from root to this node path',
          selector: 'node:selected',
          onClickFunction: (event) => {
            const node = event.target || event.cyTarget;
            const nodeId = node.data('nodeId');
            document.dispatchEvent(new CustomEvent('decision-tree-move-path-to-summary', {
              detail: {
                paneId: cy.paneId,
                nodeId,
              },
            }));
          },
          hasTrailingDivider: true,
        },
        {
          id: 'fit-view',
          content: 'Fit to view',
          tooltipText: 'Fit graph to viewport',
          coreAsWell: true,
          onClickFunction: () => {
            cy.fit(undefined, 30);
          },
          hasTrailingDivider: false,
        },
      ],
    });
  }

  // Handle edge clicks for navigation
  cy.on('tap', 'edge', (event) => {
    const edge = event.target;
    const targetNodeId = edge.target().data('nodeId');
    const edgeType = edge.data('type');
    
    document.dispatchEvent(new CustomEvent('decision-tree-edge-clicked', {
      detail: {
        target: targetNodeId,
        type: edgeType,
      },
    }));
  });

  // Fit to view on load
  cy.fit();

  return cy;
}

/**
 * Update decision tree with new data
 */
export function updateDecisionTree(cy, treeData) {
  if (!cy) return;

  cy.elements().remove();

  const elements = [];

  // Add nodes
  treeData.nodes.forEach(node => {
    elements.push({
      data: {
        id: node.id,
        label: node.label,
        nodeId: node.nodeId,
        axiom: node.label,
        repairSymbol: '',
        symbolColor: '#333',
        symbolBackground: 'transparent',
        symbolBorderColor: COLORS.NODE_COLOR,
        symbolBackgroundOpacity: 0,
      },
    });
  });

  // Add edges
  treeData.edges.forEach(edge => {
    elements.push({
      data: {
        id: edge.id,
        source: edge.source,
        target: edge.target,
        label: edge.label,
        type: edge.type,
      },
    });
  });

  cy.add(elements);
  cy.layout({
    name: 'dagre',
    directed: true,
    rankDir: 'LR', // Horizontal layout
    animate: true,
    animationDuration: 500,
  }).run();

  fitAllPanesAfterLayout();
}

/**
 * Navigate to a specific node in the tree
 */
export function navigateToNode(cy, nodeId) {
  const node = cy.getElementById(`node-${nodeId}`);
  if (node.nonempty()) {
    cy.animate({
      center: { ebb: node },
      zoom: 2,
    }, {
      duration: 500,
    });
    node.select();
  }
}

/**
 * Highlight path from root to a specific node
 */
export function highlightPath(cy, nodeId) {
  // Reset all elements
  cy.elements().removeClass('on-path');
  cy.edges().style('opacity', 0.2);

  const node = cy.getElementById(`node-${nodeId}`);
  if (node.nonempty()) {
    const path = [];
    let current = node;

    // Walk up to root
    while (current.nonempty()) {
      path.unshift(current);
      const incomers = current.incomers('edge');
      if (incomers.length > 0) {
        current = incomers[0].source();
      } else {
        break;
      }
    }

    // Highlight path
    path.forEach(element => {
      element.addClass('on-path');
    });

    // Highlight connecting edges
    for (let i = 0; i < path.length - 1; i++) {
      const edges = path[i].edgesTo(path[i + 1]);
      edges.forEach(edge => {
        edge.style('opacity', 1);
        edge.style('width', 3);
      });
    }
  }
}

/**
 * Update leaf node symbols based on parent repair status
 */
async function updateLeafNodeSymbols(cy, nodeId) {
  if (!cy || !cy.treeData) return;
  
  try {
    // Dynamically import dlRepairApi to avoid circular dependencies
    const dlRepairApi = (await import('../utils/mock-dl-repair-api.js')).default;
    const nodeIdStr = `node-${nodeId}`;
    
    const probabilities = await dlRepairApi.getImpactProbabilities(nodeId);
    if (!probabilities) return;
    
    const hasKeepRepair = probabilities.yes && probabilities.yes !== 'No Repair!';
    const hasRemoveRepair = probabilities.no && probabilities.no !== 'No Repair!';

    const childEdges = cy.treeData.edges.filter(edge => edge.source === nodeIdStr);
    childEdges.forEach(edge => {
      const childNode = cy.getElementById(edge.target);
      if (childNode.length > 0) {
        let symbol = '';
        let color = '#333';
        let background = 'transparent';
        let borderColor = COLORS.NODE_COLOR;
        let backgroundOpacity = 0;
        
        if (edge.type === 'keep') {
          if (hasKeepRepair) {
            symbol = '✓';
            color = '#2b8a3e';
            background = '#f5fff5';
            borderColor = '#d9e8d9';
            backgroundOpacity = 1;
          } else {
            symbol = '✗';
            color = '#c92a2a';
            background = '#fff5f5';
            borderColor = '#f0d6d6';
            backgroundOpacity = 1;
          }
        } else if (edge.type === 'remove') {
          if (hasRemoveRepair) {
            symbol = '✓';
            color = '#2b8a3e';
            background = '#f5fff5';
            borderColor = '#d9e8d9';
            backgroundOpacity = 1;
          } else {
            symbol = '✗';
            color = '#c92a2a';
            background = '#fff5f5';
            borderColor = '#f0d6d6';
            backgroundOpacity = 1;
          }
        }
        
        childNode.data('repairSymbol', symbol);
        childNode.data('symbolColor', color);
        childNode.data('symbolBackground', background);
        childNode.data('symbolBorderColor', borderColor);
        childNode.data('symbolBackgroundOpacity', backgroundOpacity);
      }
    });
  } catch (error) {
    console.error('Error updating leaf node symbols:', error);
  }
}

/**
 * Expand a node to show its children
 */
function getExpandedTypes(cy, nodeId) {
  let types = cy.expandedNodes.get(nodeId);
  if (!types) {
    types = new Set();
    cy.expandedNodes.set(nodeId, types);
  }
  return types;
}

function syncNodeExpansionClass(cy, nodeId) {
  if (!cy || !cy.treeData) {
    return;
  }

  const nodeIdStr = `node-${nodeId}`;
  const node = cy.getElementById(nodeIdStr);
  if (node.length === 0) {
    return;
  }

  const hasChildren = cy.treeData.edges.some(edge => edge.source === nodeIdStr);
  const expandedTypes = cy.expandedNodes.get(nodeId);
  const hasKeep = expandedTypes?.has('keep') || expandedTypes?.has('all');
  const hasRemove = expandedTypes?.has('remove') || expandedTypes?.has('all');
  const isFullyExpanded = !!(hasKeep && hasRemove);
  const isPartiallyExpanded = !!(!isFullyExpanded && (hasKeep || hasRemove));

  node.removeClass('leaf has-children expanded partially-expanded');

  if (!hasChildren) {
    node.addClass('leaf');
    return;
  }

  if (isFullyExpanded) {
    node.addClass('expanded');
    return;
  }

  if (isPartiallyExpanded) {
    node.addClass('partially-expanded');
    return;
  }

  node.addClass('has-children');
}

export function expandNode(cy, nodeId) {
  if (!cy || !cy.treeData) return;

  const nodeIdStr = `node-${nodeId}`;
  
  console.log(`Expanding node ${nodeId}, looking for ${nodeIdStr}`);
  console.log('Current nodes in cy:', cy.nodes().map(n => n.id()).join(', '));
  console.log('Tree data has', cy.treeData.nodes.length, 'nodes');
  
  // Check if node exists in cy
  if (cy.getElementById(nodeIdStr).length === 0) {
    console.error(`Node ${nodeIdStr} does not exist in cy instance!`);
    return;
  }
  
  // Check if already fully expanded
  const expandedTypes = getExpandedTypes(cy, nodeId);
  if (expandedTypes.has('all')) {
    console.log(`Node ${nodeId} already expanded`);
    return;
  }

  // Find children edges from tree data
  const childEdges = cy.treeData.edges.filter(edge => edge.source === nodeIdStr);
  
  console.log(`Found ${childEdges.length} child edges for ${nodeIdStr}`);
  
  if (childEdges.length === 0) {
    console.log(`Node ${nodeId} is a leaf node`);
    return;
  }

  // Get target node IDs
  const targetNodeIds = childEdges.map(edge => edge.target);
  
  // Find child nodes from tree data
  const childNodes = cy.treeData.nodes.filter(node => targetNodeIds.includes(node.id));

  // Add child nodes that don't exist yet
  const newElements = [];
  childNodes.forEach(node => {
    if (cy.getElementById(node.id).length === 0) {
      newElements.push({
        data: {
          id: node.id,
          label: node.label,
          nodeId: node.nodeId,
          axiom: node.label,
          repairSymbol: '',
          symbolColor: '#333',
          symbolBackground: 'transparent',
          symbolBorderColor: COLORS.NODE_COLOR,
          symbolBackgroundOpacity: 0,
        },
        classes: getNodeClasses(node.id, cy.treeData),
      });
    }
  });

  // Add edges that don't exist yet
  childEdges.forEach(edge => {
    if (cy.getElementById(edge.id).length === 0) {
      newElements.push({
        data: {
          id: edge.id,
          source: edge.source,
          target: edge.target,
          label: edge.label,
          type: edge.type,
        },
      });
    }
  });

  if (newElements.length > 0) {
    cy.add(newElements);

    expandedTypes.add('keep');
    expandedTypes.add('remove');
    expandedTypes.add('all');
    syncNodeExpansionClass(cy, nodeId);
    
    // Re-run layout
    cy.layout({
      name: 'dagre',
      directed: true,
      rankDir: 'LR',
      animate: true,
      animationDuration: 500,
    }).run();

    dispatchPaneDataChanged(cy);
    fitAllPanesAfterLayout();
    updateLeafNodeSymbols(cy, nodeId);
  }
}

/**
 * Expand a node only along a specific edge type (keep/remove)
 */
export function expandNodeByType(cy, nodeId, edgeType) {
  if (!cy || !cy.treeData) return;

  const nodeIdStr = `node-${nodeId}`;

  // Check if node exists in cy
  if (cy.getElementById(nodeIdStr).length === 0) {
    console.error(`Node ${nodeIdStr} does not exist in cy instance!`);
    return;
  }

  const expandedTypes = getExpandedTypes(cy, nodeId);
  if (expandedTypes.has('all') || expandedTypes.has(edgeType)) {
    return;
  }

  const childEdges = cy.treeData.edges.filter(
    edge => edge.source === nodeIdStr && edge.type === edgeType,
  );

  if (childEdges.length === 0) {
    return;
  }

  const targetNodeIds = childEdges.map(edge => edge.target);
  const childNodes = cy.treeData.nodes.filter(node => targetNodeIds.includes(node.id));

  const newElements = [];
  childNodes.forEach(node => {
    if (cy.getElementById(node.id).length === 0) {
      newElements.push({
        data: {
          id: node.id,
          label: node.label,
          nodeId: node.nodeId,
          axiom: node.label,
          repairSymbol: '',
          symbolColor: '#333',
          symbolBackground: 'transparent',
          symbolBorderColor: COLORS.NODE_COLOR,
          symbolBackgroundOpacity: 0,
        },
        classes: getNodeClasses(node.id, cy.treeData),
      });
    }
  });

  childEdges.forEach(edge => {
    if (cy.getElementById(edge.id).length === 0) {
      newElements.push({
        data: {
          id: edge.id,
          source: edge.source,
          target: edge.target,
          label: edge.label,
          type: edge.type,
        },
      });
    }
  });

  if (newElements.length > 0) {
    cy.add(newElements);

    expandedTypes.add(edgeType);
    syncNodeExpansionClass(cy, nodeId);

    cy.layout({
      name: 'dagre',
      directed: true,
      rankDir: 'LR',
      animate: true,
      animationDuration: 500,
    }).run();

    dispatchPaneDataChanged(cy);
    fitAllPanesAfterLayout();
    updateLeafNodeSymbols(cy, nodeId);
  }
}

/**
 * Collapse a node by removing its visible descendants
 */
function collapseNode(cy, nodeId) {
  if (!cy || !cy.treeData) return;

  const nodeIdStr = `node-${nodeId}`;
  const currentNode = cy.getElementById(nodeIdStr);
  if (currentNode.length === 0) {
    return;
  }

  const expandedTypes = cy.expandedNodes.get(nodeId);
  if (!expandedTypes || expandedTypes.size === 0) {
    return;
  }

  const toRemoveNodes = new Set();
  const toRemoveEdges = new Set();
  const stack = [nodeIdStr];

  while (stack.length > 0) {
    const currentIdStr = stack.pop();
    const edges = cy.treeData.edges.filter(edge => edge.source === currentIdStr);
    edges.forEach(edge => {
      toRemoveEdges.add(edge.id);
      toRemoveNodes.add(edge.target);
      stack.push(edge.target);
    });
  }

  const existingNodeIds = Array.from(toRemoveNodes)
    .filter(id => cy.getElementById(id).length > 0);
  const existingEdgeIds = Array.from(toRemoveEdges)
    .filter(id => cy.getElementById(id).length > 0);

  if (existingNodeIds.length === 0 && existingEdgeIds.length === 0) {
    return;
  }

  if (existingEdgeIds.length > 0) {
    cy.remove(cy.$(existingEdgeIds.map(id => `#${id}`).join(', ')));
  }

  if (existingNodeIds.length > 0) {
    cy.remove(cy.$(existingNodeIds.map(id => `#${id}`).join(', ')));
  }

  existingNodeIds.forEach((id) => {
    const childId = Number(id.replace('node-', ''));
    if (!Number.isNaN(childId)) {
      cy.expandedNodes.delete(childId);
    }
  });

  cy.expandedNodes.delete(nodeId);
  currentNode.removeClass('expanded partially-expanded leaf has-children');
  syncNodeExpansionClass(cy, nodeId);

  cy.layout({
    name: 'dagre',
    directed: true,
    rankDir: 'LR',
    animate: true,
    animationDuration: 500,
  }).run();

  dispatchPaneDataChanged(cy);

  fitAllPanesAfterLayout();
}

/**
 * Extract subtree starting from a given node
 */
function extractSubtree(treeData, nodeId) {
  const nodeIdStr = `node-${nodeId}`;
  const visited = new Set();
  const subtreeNodes = [];
  const subtreeEdges = [];

  function traverse(currentIdStr) {
    if (visited.has(currentIdStr)) return;
    visited.add(currentIdStr);

    // Find the node
    const node = treeData.nodes.find(n => n.id === currentIdStr);
    if (node) {
      subtreeNodes.push(node);
    }

    // Find edges from this node
    const edges = treeData.edges.filter(e => e.source === currentIdStr);
    edges.forEach(edge => {
      subtreeEdges.push(edge);
      traverse(edge.target);
    });
  }

  traverse(nodeIdStr);

  return {
    nodes: subtreeNodes,
    edges: subtreeEdges,
  };
}

/**
 * Expand node in a new pane
 */
export function expandNodeInNewPane(cy, nodeId) {
  if (!cy || !cy.treeData) return;

  // Extract subtree from this node
  const subtree = extractSubtree(cy.treeData, nodeId);
  
  if (subtree.nodes.length === 0) {
    console.log(`Node ${nodeId} has no subtree`);
    return;
  }

  // Get pane ID if available
  const paneId = cy.container().closest('.pane')?.id || 'pane-0';
  
  // Create new pane
  const newPane = spawnPane({
    spawner: paneId,
    id: `dl-repair-${Date.now()}`,
    newPanePosition: 'right',
  }, [nodeId], [nodeId]);

  if (!newPane) {
    console.error('Failed to create new pane');
    return;
  }

  // Get the actual DOM container element
  const newContainer = document.getElementById(newPane.container);
  if (!newContainer) {
    console.error('Failed to find pane container element');
    return;
  }

  // Create decision tree in new pane
  const newCy = createInitialTree(newContainer, subtree);
  
  if (newCy) {
    newCy.paneId = newPane.id;
    newPane.cy = newCy;
    document.dispatchEvent(new CustomEvent('decision-tree-pane-ready', {
      detail: { paneId: newPane.id },
    }));
    dispatchPaneDataChanged(newCy);
    
    // Auto-expand the root node in the new pane
    setTimeout(() => {
      const rootNode = subtree.nodes[0];
      if (rootNode) {
        expandNode(newCy, rootNode.nodeId);
      }

      // Fit all panes to view after new pane creation and root expansion
      fitAllPanesAfterLayout(300);
    }, 100);
  }
}

/**
 * Create initial tree with only root node
 */
export function createInitialTree(container, treeData) {
  if (!container || !treeData) {
    console.error('Container or tree data not provided');
    return null;
  }

  // Find root node - either the one with no incoming edges, or the first node
  let rootNode = null;
  
  // Get all target node IDs (nodes that have incoming edges)
  const targetIds = new Set(treeData.edges.map(e => e.target));
  
  console.log('Finding root node. Total nodes:', treeData.nodes.length, 'Targets:', targetIds.size);
  
  // Find node with no incoming edges
  rootNode = treeData.nodes.find(node => !targetIds.has(node.id));
  
  // If all nodes have incoming edges (shouldn't happen), use first node
  if (!rootNode && treeData.nodes.length > 0) {
    console.warn('No node without incoming edges found, using first node');
    rootNode = treeData.nodes[0];
  }
  
  if (!rootNode) {
    console.error('Root node not found');
    return null;
  }
  
  console.log('Found root node:', JSON.stringify(rootNode));

  // Create tree with only root node
  const initialData = {
    nodes: [
      {
        id: rootNode.id,
        label: rootNode.label,
        nodeId: rootNode.nodeId,
      },
    ],
    edges: [],
  };

  console.log('Creating initial tree with root node:', rootNode.id, 'nodeId:', rootNode.nodeId);
  console.log('Root node structure:', {id: rootNode.id, nodeId: rootNode.nodeId, label: rootNode.label});
  console.log('Full tree data has', treeData.nodes.length, 'nodes and', treeData.edges.length, 'edges');

  // Pass full treeData as third parameter for proper node classification
  const cy = createDecisionTree(container, initialData, treeData);
  
  if (!cy) {
    console.error('Failed to create cy instance');
    return null;
  }
  
  console.log('Cy instance created, nodes in cy:', cy.nodes().length);
  cy.nodes().forEach(n => {
    console.log('Node in cy:', n.id(), 'label:', n.data('label'), 'nodeId:', n.data('nodeId'));
  });
  
  // Store full tree data for later expansion
  cy.treeData = treeData;
  cy.expandedNodes = new Map();

  return cy;
}

/**
 * Get node classes based on whether it has children
 */
function getNodeClasses(nodeId, treeData) {
  const hasChildren = treeData.edges.some(edge => edge.source === nodeId);
  if (!hasChildren) {
    return 's leaf';
  }
  return 's has-children';
}

export default {
  createDecisionTree,
  updateDecisionTree,
  navigateToNode,
  highlightPath,
};
