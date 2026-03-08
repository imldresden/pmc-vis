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
      selector: 'node.s.expanded:selected',
      style: {
        'border-color': COLORS.SELECTED_BORDER,
        'border-width': OUTLINES.width_selected,
        'border-style': 'double',
      },
    },
    {
      selector: 'node.s.leaf',
      style: {
        // Leaf nodes - empty circle
        label: '',
        shape: 'ellipse',
        width: 10,
        height: 10,
        'background-opacity': 0,
        'border-color': COLORS.NODE_COLOR,
        'border-width': OUTLINES.width,
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
      selector: 'edge[type="yes"]',
      style: {
        'line-color': '#22c55e', // Green for yes
        'target-arrow-color': '#22c55e',
      },
    },
    {
      selector: 'edge[type="no"]',
      style: {
        'line-color': '#ef4444', // Red for no
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
    
    // y/n: expand yes/no edge in current pane
    if (e.key === 'y' || e.key === 'Y') {
      if (e._dlRepairHandled) {
        return;
      }
      e.preventDefault();
      e._dlRepairHandled = true;
      expandNodeByType(cy, selectedNodes[0].data('nodeId'), 'yes');
      return;
    }

    if (e.key === 'n' || e.key === 'N') {
      if (e._dlRepairHandled) {
        return;
      }
      e.preventDefault();
      e._dlRepairHandled = true;
      expandNodeByType(cy, selectedNodes[0].data('nodeId'), 'no');
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
      // Go to first visible child, preferring 'yes' over 'no'
      const currentNode = selectedNodes[0];
      const childEdges = cy.treeData.edges.filter(edge => edge.source === currentNode.id());
      if (childEdges.length > 0) {
        // Find visible children
        const visibleChildren = childEdges
          .map(edge => ({ edge, node: cy.getElementById(edge.target) }))
          .filter(item => item.node.length > 0);
        
        if (visibleChildren.length > 0) {
          // Prefer 'yes' child over 'no' child
          const yesChild = visibleChildren.find(item => item.edge.type === 'yes');
          const targetChild = yesChild || visibleChildren[0];
          
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
          selector: 'node.expanded',
          onClickFunction: (event) => {
            const node = event.target || event.cyTarget;
            const nodeId = node.data('nodeId');
            collapseNode(cy, nodeId);
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
    
    // Mark parent node as expanded
    cy.getElementById(nodeIdStr).removeClass('has-children').addClass('expanded');

    expandedTypes.add('yes');
    expandedTypes.add('no');
    expandedTypes.add('all');
    
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
  }
}

/**
 * Expand a node only along a specific edge type (yes/no)
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

    cy.getElementById(nodeIdStr).removeClass('has-children').addClass('expanded');
    expandedTypes.add(edgeType);

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
  currentNode.removeClass('expanded leaf has-children');
  const hasChildren = cy.treeData.edges.some(edge => edge.source === nodeIdStr);
  currentNode.addClass(hasChildren ? 'has-children' : 'leaf');

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
