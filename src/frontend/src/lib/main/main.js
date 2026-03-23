import { spawnPane, getPanes } from '../views/panes/panes.js';
import { params } from '../views/graph/layout-options/klay.js';
import { spawnGraph } from '../views/graph/node-link.js';
import { PROJECT } from '../utils/controls.js';
import { CONSTANTS } from '../utils/names.js';
import { socket } from '../views/imports/import-socket.js';
import { createDecisionTree, createInitialTree, expandNode, expandNodeByType } from '../views/decision-tree.js';
import { createAxiomPane, getAxiomStatesForPane, clearAxiomStatesForPane, AXIOM_STATES, setSummaryNodeState, setSummaryStateByDepth, resetSummaryStates } from '../views/axiom-pane.js';
import { parallelCoords } from '../views/attributes/parallel-coords.js';
import dlRepairApi from '../utils/mock-dl-repair-api.js';

let BACKEND = import.meta.env.VITE_BACKEND_RESTFUL;
const DL_REPAIR_SIDEBAR_WIDTH_KEY = 'dl-repair-sidebar-width';
let dlRepairSidebarResizeInitialized = false;

const STAR_AXIS_DEFAULT_STROKE = '#b8b8b8';
const STAR_AXIS_DEFAULT_STROKE_WIDTH = '1';
const STAR_AXIS_HIGHLIGHT_STROKE = '#f08c00';
const STAR_AXIS_HIGHLIGHT_STROKE_WIDTH = '2.6';

function resetGlobalStarAxisHighlight() {
  document.querySelectorAll('.decision-tree-star-svg .decision-tree-star-axis-line').forEach((axisLine) => {
    const defaultStroke = axisLine.getAttribute('data-default-stroke') || STAR_AXIS_DEFAULT_STROKE;
    const defaultStrokeWidth = axisLine.getAttribute('data-default-stroke-width') || STAR_AXIS_DEFAULT_STROKE_WIDTH;
    axisLine.setAttribute('stroke', defaultStroke);
    axisLine.setAttribute('stroke-width', defaultStrokeWidth);
    axisLine.setAttribute('stroke-opacity', '1');
  });

  document.querySelectorAll('.decision-tree-star-svg .decision-tree-star-axis-label').forEach((axisLabel) => {
    const defaultWeight = axisLabel.getAttribute('data-default-font-weight') || '500';
    axisLabel.setAttribute('font-weight', defaultWeight);
  });
}

function highlightGlobalStarAxis(axisName) {
  const axis = String(axisName || '');
  if (!axis) {
    resetGlobalStarAxisHighlight();
    return;
  }

  document.querySelectorAll('.decision-tree-star-svg .decision-tree-star-axis-line').forEach((axisLine) => {
    const lineAxis = axisLine.getAttribute('data-axis-name');
    if (lineAxis === axis) {
      axisLine.setAttribute('stroke', STAR_AXIS_HIGHLIGHT_STROKE);
      axisLine.setAttribute('stroke-width', STAR_AXIS_HIGHLIGHT_STROKE_WIDTH);
      axisLine.setAttribute('stroke-opacity', '1');
      axisLine.setAttribute('stroke-linecap', 'round');
      axisLine.parentNode?.appendChild(axisLine);
      return;
    }

    const defaultStroke = axisLine.getAttribute('data-default-stroke') || STAR_AXIS_DEFAULT_STROKE;
    const defaultStrokeWidth = axisLine.getAttribute('data-default-stroke-width') || STAR_AXIS_DEFAULT_STROKE_WIDTH;
    axisLine.setAttribute('stroke', defaultStroke);
    axisLine.setAttribute('stroke-width', defaultStrokeWidth);
    axisLine.setAttribute('stroke-opacity', '1');
  });

  document.querySelectorAll('.decision-tree-star-svg .decision-tree-star-axis-label').forEach((axisLabel) => {
    const labelAxis = axisLabel.getAttribute('data-axis-name');
    const defaultWeight = axisLabel.getAttribute('data-default-font-weight') || '500';
    axisLabel.setAttribute('font-weight', labelAxis === axis ? '700' : defaultWeight);
  });
}

if (typeof window !== 'undefined') {
  window.dlRepairHighlightStarAxis = highlightGlobalStarAxis;
  window.dlRepairClearStarAxisHighlight = resetGlobalStarAxisHighlight;
}

// Track project type
let PROJECT_TYPE = 'prism'; // 'prism' or 'dl-repair'

const info = {
  details: {},
  observer: new ResizeObserver((ms) => {
    const panes = getPanes(); // TODO: move panes to be part of this object?
    ms.forEach(m => {
      const pane = panes[m.target.pane];
      if (!pane || !pane.cy) {
        return;
      }
      pane.cy.fit(undefined, 30);
      pane.cy.pcp?.redraw();
    });
  }),
}; // singleton

function getDefaultBadge(name) {
  return `<i class="fa-xs ${
    CONSTANTS.INTERACTIONS[name].icon
  }" title="${
    CONSTANTS.INTERACTIONS[name].type
  }"></i>`;
}

function setInfo(newInfo) {
  Object.keys(newInfo).forEach(k => {
    info[k] = newInfo[k];
  });
  info.details = {};
  info.types = {};
  ['s', 't'].forEach(type => {
    Object.keys(info[type]).forEach(k => {
      info.details[k] = info[type][k];
      const t = info.types[k];
      info.types[k] = t ? t + '+' + type : type;
    });
    delete info[type];
  });

  info.badges = {
    ap_init: getDefaultBadge('ap_init'),
    ap_deadlock: getDefaultBadge('ap_deadlock'),
    ap_end: getDefaultBadge('ap_end'),
  };

  Object.keys(info.badges).forEach(ap => {
    const userSelected = info.details[CONSTANTS.atomicPropositions][CONSTANTS[ap]];
    if (userSelected) {
      if (userSelected.icon) {
        info.badges[ap] = `<i class="fa-xs ${userSelected.identifier}" title="${CONSTANTS.INTERACTIONS[ap].type}"></i>`;
      } else {
        info.badges[ap] = `<p title="${CONSTANTS.INTERACTIONS[ap].type}">${userSelected.identifier}</p>`;
      }
    }
  });

  Object.values(getPanes()).forEach(pane => {
    pane.cy.vars['update'].fn(pane.cy);
  });
}

const ww = window.innerWidth;
const numberOfPanes = document.getElementById('numberOfPanes');
if (ww && numberOfPanes) {
  numberOfPanes.value = Math.floor(ww / 200);
}

if (import.meta.env.VITE_HIDE_TODOS !== 'true') {
  document.querySelectorAll('.to-do').forEach(el => el.classList.remove('to-do'));
}

addEventListener('linked-selection', e => {
  const selection = e.detail.selection;
  const panes = getPanes();
  panes[e.detail.pane].cy.nodes().unselect();
  const ids = Array.from(new Set(selection
    .map(n => n.linkedId || n.id)
    .filter(Boolean)));
  const strSelection = '#' + ids.join(', #');

  if (strSelection !== '#') {
    panes[e.detail.pane].cy.$(strSelection).select();
  }
}, true);

const interval = setInterval(async () => {
  if (socket.connected) {
    clearInterval(interval);
    start();
  } else {
    console.log('waiting for socket...');
  }
}, 50);

async function checkProjectType() {
  try {
    // Try to fetch project metadata to determine type
    const response = await fetch(`${BACKEND}/${PROJECT}/project-info`);
    if (response.ok) {
      const data = await response.json();
      return data.type || 'prism';
    }
  } catch (error) {
    console.log('Could not fetch project info, assuming PRISM mode');
  }
  return 'prism';
}

function setupDLRepairSidebarResize() {
  if (dlRepairSidebarResizeInitialized) {
    return;
  }

  const body = document.body;
  const root = document.documentElement;
  const resizer = document.getElementById('config-resizer');
  if (!body || !root || !resizer) {
    return;
  }

  const savedWidth = Number(window.localStorage.getItem(DL_REPAIR_SIDEBAR_WIDTH_KEY));
  if (!Number.isNaN(savedWidth) && savedWidth > 0) {
    root.style.setProperty('--config-width', `${savedWidth}px`);
  }

  let isResizing = false;
  let startX = 0;
  let startWidth = 0;

  const triggerPaneResize = () => {
    const panes = getPanes();
    Object.values(panes).forEach((pane) => {
      if (!pane?.cy) {
        return;
      }
      pane.cy.resize();
      pane.cy.fit(undefined, 30);
      pane.cy.pcp?.redraw();
    });
  };

  const onMouseMove = (event) => {
    if (!isResizing) {
      return;
    }

    const minWidth = 240;
    const maxWidth = Math.max(360, Math.floor(window.innerWidth * 0.7));
    const delta = startX - event.clientX;
    const nextWidth = Math.max(minWidth, Math.min(maxWidth, startWidth + delta));

    root.style.setProperty('--config-width', `${nextWidth}px`);
  };

  const onMouseUp = () => {
    if (!isResizing) {
      return;
    }
    isResizing = false;
    body.classList.remove('config-resizing');

    triggerPaneResize();

    const currentWidth = Number.parseFloat(
      window.getComputedStyle(root).getPropertyValue('--config-width'),
    );
    if (!Number.isNaN(currentWidth)) {
      window.localStorage.setItem(DL_REPAIR_SIDEBAR_WIDTH_KEY, String(Math.round(currentWidth)));
    }

    window.removeEventListener('mousemove', onMouseMove);
    window.removeEventListener('mouseup', onMouseUp);
  };

  resizer.addEventListener('mousedown', (event) => {
    if (body.classList.contains('config-closed')) {
      return;
    }

    isResizing = true;
    startX = event.clientX;
    startWidth = Number.parseFloat(window.getComputedStyle(root).getPropertyValue('--config-width')) || 350;
    body.classList.add('config-resizing');

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    event.preventDefault();
  });

  dlRepairSidebarResizeInitialized = true;
}

function normalizeAxiomText(axiomText) {
  if (typeof axiomText !== 'string') {
    return '';
  }
  return axiomText.replace(/\s+/g, ' ').trim();
}

function applyRepairAxiomsToSummary(summaryCy, paneId, repairAxioms) {
  if (!summaryCy) {
    return;
  }

  const removeSet = new Set(
    (Array.isArray(repairAxioms) ? repairAxioms : [])
      .map(normalizeAxiomText)
      .filter(Boolean),
  );

  summaryCy.nodes().forEach((node) => {
    const axiomText = normalizeAxiomText(node.data('fullLabel') || node.data('label'));
    const nextState = removeSet.has(axiomText)
      ? AXIOM_STATES.REMOVED
      : AXIOM_STATES.KEPT;
    setSummaryNodeState(summaryCy, paneId, node.id(), nextState);
  });
}

async function startDLRepairProject() {
  console.log('Starting DL Repair Project');
  
  // Hide PRISM-specific config sections
  const cyConfig = document.getElementById('cy-config');
  if (cyConfig?.parentElement?.parentElement) {
    cyConfig.parentElement.parentElement.style.display = 'none';
  }
  
  const pcpConfigSpan = document.getElementById('pcp-config-span');
  if (pcpConfigSpan?.parentElement) {
    pcpConfigSpan.parentElement.style.display = 'none';
  }
  
  const overviewConfigSpan = document.getElementById('overview-config-span');
  if (overviewConfigSpan?.parentElement) {
    overviewConfigSpan.parentElement.style.display = 'none';
  }

  setupDLRepairSidebarResize();

  try {
    // Initialize decision tree data
    const treeData = await dlRepairApi.initializeDecisionTree();
    
    if (document.getElementById('project-id')) {
      document.getElementById('project-id').innerHTML = PROJECT;
    }

    if (!treeData || !treeData.nodes || treeData.nodes.length === 0) {
      throw new Error('No decision tree data available');
    }

    // Extract node IDs for pane registration
    const nodesIds = treeData.nodes.map(node => node.id);
    
    // Create axiom pane as fixed first pane
    const axiomPaneId = 'axiom-pane-0';
    const axiomPane = spawnPane(
      { id: axiomPaneId },
      nodesIds,
    );
    
    // Mark axiom pane as fixed and apply styling
    const axiomPaneDiv = document.getElementById(axiomPaneId);
    if (axiomPaneDiv) {
      axiomPaneDiv.classList.add('axiom-pane-fixed');
      axiomPaneDiv.style.flexBasis = '220px';
      axiomPaneDiv.style.flex = '0 0 220px';
      axiomPaneDiv.style.minWidth = '220px';
    }
    
    // Hide dragbar for axiom pane
    const axiomDragbar = document.getElementById(axiomPane.dragbar);
    if (axiomDragbar) {
      axiomDragbar.style.display = 'none';
      axiomDragbar.style.pointerEvents = 'none'; // Prevent interaction even if visible
    }
    
    // Get the axiom cytoscape container
    const axiomContainer = document.getElementById(axiomPane.container);
    if (!axiomContainer) {
      throw new Error('Failed to find axiom pane container');
    }
    
    // Add header to axiom pane (reuse axiomPaneDiv from above)
    if (axiomPaneDiv) {
      const axiomHeader = document.createElement('div');
      axiomHeader.className = 'axiom-pane-header';
      axiomHeader.textContent = 'SUMMARY VIEW';
      
      // Insert header at the beginning of the pane div
      axiomPaneDiv.insertBefore(axiomHeader, axiomPaneDiv.firstChild);
    }
    
    // Create axiom pane visualization
    const axiomCy = createAxiomPane(axiomContainer, treeData, axiomPaneId);
    if (!axiomCy) {
      throw new Error('Failed to create axiom pane visualization');
    }
    
    axiomCy.paneId = axiomPaneId;
    axiomPane.cy = axiomCy;
    
    // Hide details pane for axiom pane
    const axiomDetailsDiv = document.getElementById(axiomPane.details);
    if (axiomDetailsDiv) {
      axiomDetailsDiv.style.display = 'none';
    }
    
    const axiomSplitDragbar = axiomContainer.nextElementSibling;
    if (axiomSplitDragbar && axiomSplitDragbar.classList.contains('split-dragbar')) {
      axiomSplitDragbar.style.display = 'none';
    }
    
    // Adjust axiom pane controls
    const axiomControls = document.getElementById(`${axiomPane.container}-controls`);
    if (axiomControls) {
      const closeBtn = axiomControls.querySelector('.pane-close');
      if (closeBtn) {
        closeBtn.style.display = 'none'; // Hide close button
      }
    }
    
    // Create pane using the same system as PRISM mode
    const firstPaneId = 'pane-0';
    const pane = spawnPane(
      { id: firstPaneId },
      nodesIds,
    );

    // Get the cytoscape container from the pane
    const container = document.getElementById(pane.container);
    if (!container) {
      throw new Error('Failed to find pane container');
    }

    // Create decision tree visualization with only root node initially
    const cy = createInitialTree(container, treeData);

    if (!cy) {
      throw new Error('Failed to create decision tree visualization');
    }

    // Store cy instance in pane (required for pane system)
    cy.paneId = firstPaneId;
    pane.cy = cy;

    const initialCanvas = document.querySelector(`#${pane.container} canvas`);
    if (initialCanvas) {
      initialCanvas.pane = pane.id;
      info.observer.observe(initialCanvas);
    }

    await updateDecisionTreePCP(pane, []);

    // Add node selection handler
    document.addEventListener('decision-tree-node-selected', async (event) => {
      document.dispatchEvent(new CustomEvent('hamming-repair-preview-clear'));

      const nodeId = event.detail.nodeId;
      const selectedNodeIds = event.detail.selectedNodeIds || [];
      const panes = getPanes();
      const targetPane = panes[event.detail.paneId] || pane;
      console.log('Node selected:', nodeId);

      if (nodeId === null || selectedNodeIds.length === 0) {
        displayNodeDetails('', nodeId, targetPane);
        await updateDecisionTreePCP(targetPane, []);
        return;
      }

      // Fetch and display probabilities + hamming distance for the selected node
      try {
        const probabilitiesPromise = dlRepairApi.getImpactProbabilities(nodeId);
        const hammingPromise = dlRepairApi.getHammingDistance(nodeId);
        const probabilities = await probabilitiesPromise;
        const hammingDistance = await hammingPromise;
        const html = generateNodeDetailsHTML(probabilities, hammingDistance);
        displayNodeDetails(html, nodeId, targetPane, hammingDistance);

        // Update child leaf nodes with repair status symbols
        if (targetPane && targetPane.cy && targetPane.cy.treeData) {
          const hasKeepRepair = probabilities && probabilities.yes && probabilities.yes !== 'No Repair!';
          const hasRemoveRepair = probabilities && probabilities.no && probabilities.no !== 'No Repair!';

          const childEdges = targetPane.cy.treeData.edges.filter(edge => edge.source === `node-${nodeId}`);
          childEdges.forEach(edge => {
            const childNode = targetPane.cy.getElementById(edge.target);
            if (childNode.length > 0) {
              let symbol = '';
              let symbolColor = '#333';
              let symbolBackground = 'transparent';
              let symbolBorderColor = '#555';
              let symbolBackgroundOpacity = 0;
              if (edge.type === 'keep') {
                if (hasKeepRepair) {
                  symbol = '✓';
                  symbolColor = '#2b8a3e';
                  symbolBackground = '#f5fff5';
                  symbolBorderColor = '#d9e8d9';
                  symbolBackgroundOpacity = 1;
                } else {
                  symbol = '✗';
                  symbolColor = '#c92a2a';
                  symbolBackground = '#fff5f5';
                  symbolBorderColor = '#f0d6d6';
                  symbolBackgroundOpacity = 1;
                }
              } else if (edge.type === 'remove') {
                if (hasRemoveRepair) {
                  symbol = '✓';
                  symbolColor = '#2b8a3e';
                  symbolBackground = '#f5fff5';
                  symbolBorderColor = '#d9e8d9';
                  symbolBackgroundOpacity = 1;
                } else {
                  symbol = '✗';
                  symbolColor = '#c92a2a';
                  symbolBackground = '#fff5f5';
                  symbolBorderColor = '#f0d6d6';
                  symbolBackgroundOpacity = 1;
                }
              }
              childNode.data('repairSymbol', symbol);
              childNode.data('symbolColor', symbolColor);
              childNode.data('symbolBackground', symbolBackground);
              childNode.data('symbolBorderColor', symbolBorderColor);
              childNode.data('symbolBackgroundOpacity', symbolBackgroundOpacity);
            }
          });
        }
      } catch (error) {
        console.error('Error fetching probabilities:', error);
        displayNodeDetails('', nodeId, targetPane);
      }

      await updateDecisionTreePCP(targetPane, selectedNodeIds);
    });

    document.addEventListener('decision-tree-pane-ready', (event) => {
      const paneId = event.detail.paneId;
      const panes = getPanes();
      const targetPane = panes[paneId];
      if (!targetPane) {
        return;
      }
      const canvas = document.querySelector(`#${targetPane.container} canvas`);
      if (canvas) {
        canvas.pane = targetPane.id;
        info.observer.observe(canvas);
      }

      updateDecisionTreePCP(targetPane, []);
    });

    document.addEventListener('decision-tree-pane-data-changed', (event) => {
      const paneId = event.detail.paneId;
      const panes = getPanes();
      const targetPane = panes[paneId];
      if (!targetPane || !targetPane.cy) {
        return;
      }
      const selectedNodeIds = targetPane.cy.$('node:selected').map(n => n.data('nodeId'));
      updateDecisionTreePCP(targetPane, selectedNodeIds);
    });

    document.addEventListener('decision-tree-node-hovered', (event) => {
      const panes = getPanes();
      const targetPane = panes[event.detail.paneId] || pane;
      if (!targetPane?.cy?.pcp?.setHoveredNode) {
        return;
      }
      targetPane.cy.pcp.setHoveredNode(event.detail.nodeId);
    });

    // Add edge click handler for navigation
    document.addEventListener('decision-tree-edge-clicked', (event) => {
      const targetNodeId = event.detail.target;
      const edgeType = event.detail.type;
      console.log(`Navigate via ${edgeType} to node ${targetNodeId}`);

      // You can add navigation logic here if needed
    });

    // Add axiom state change handler
    document.addEventListener('axiom-state-changed', (event) => {
      const { paneId, nodeId, state } = event.detail;
      console.log(`Axiom state changed: ${nodeId} -> ${state}`);
      
      // Optionally, you can add logic here to update the tree visualization
      // based on axiom state changes (e.g., highlight nodes in tree based on axiom states)
    });

    document.addEventListener('decision-tree-move-path-to-summary', (event) => {
      const { paneId, nodeId } = event.detail || {};
      if (nodeId === undefined || nodeId === null) {
        return;
      }

      const panes = getPanes();
      const sourcePane = panes[paneId] || pane;
      const summaryPane = panes[axiomPaneId];
      if (!sourcePane?.cy || !summaryPane?.cy || !sourcePane.cy.treeData) {
        return;
      }

      const tree = sourcePane.cy.treeData;
      const targetId = `node-${nodeId}`;

      const incomingByTarget = new Map();
      tree.edges.forEach((edge) => {
        incomingByTarget.set(edge.target, edge);
      });

      const nodeDepths = new Map();
      const targetIds = new Set(tree.edges.map(e => e.target));
      const rootNodes = tree.nodes.filter(n => !targetIds.has(n.id));
      const queue = [];
      rootNodes.forEach((rootNode) => {
        nodeDepths.set(rootNode.id, 0);
        queue.push(rootNode.id);
      });

      while (queue.length > 0) {
        const currentId = queue.shift();
        const depth = nodeDepths.get(currentId);
        tree.edges
          .filter(edge => edge.source === currentId)
          .forEach((edge) => {
            if (!nodeDepths.has(edge.target)) {
              nodeDepths.set(edge.target, depth + 1);
              queue.push(edge.target);
            }
          });
      }

      resetSummaryStates(summaryPane.cy, axiomPaneId);

      let cursor = targetId;
      while (incomingByTarget.has(cursor)) {
        const edge = incomingByTarget.get(cursor);
        const parentDepth = nodeDepths.get(edge.source);
        if (parentDepth !== undefined) {
          if (edge.type === 'keep') {
            setSummaryStateByDepth(summaryPane.cy, axiomPaneId, parentDepth, AXIOM_STATES.KEPT);
          } else if (edge.type === 'remove') {
            setSummaryStateByDepth(summaryPane.cy, axiomPaneId, parentDepth, AXIOM_STATES.REMOVED);
          }
        }
        cursor = edge.source;
      }
    });

    let summaryPreviewSnapshot = null;

    const clearSummaryPreview = () => {
      if (!summaryPreviewSnapshot) {
        return;
      }

      const panes = getPanes();
      const summaryPane = panes[axiomPaneId];
      if (!summaryPane?.cy) {
        summaryPreviewSnapshot = null;
        return;
      }

      summaryPane.cy.nodes().forEach((node) => {
        const restoredState = summaryPreviewSnapshot[node.id()] || AXIOM_STATES.UNDECIDED;
        setSummaryNodeState(summaryPane.cy, axiomPaneId, node.id(), restoredState);
      });

      summaryPreviewSnapshot = null;
    };

    document.addEventListener('hamming-repair-hover', (event) => {
      const { choice, distance } = event.detail || {};
      if (!distance || (choice !== 'yes' && choice !== 'no')) {
        return;
      }

      const panes = getPanes();
      const summaryPane = panes[axiomPaneId];
      if (!summaryPane?.cy) {
        return;
      }

      if (!summaryPreviewSnapshot) {
        const currentStates = getAxiomStatesForPane(axiomPaneId) || {};
        summaryPreviewSnapshot = { ...currentStates };
      }

      const repairAxioms = choice === 'yes'
        ? distance.hamming_yes_repair
        : distance.hamming_no_repair;
      applyRepairAxiomsToSummary(summaryPane.cy, axiomPaneId, repairAxioms);
    });

    document.addEventListener('hamming-repair-hover-end', () => {
      clearSummaryPreview();
    });

    document.addEventListener('hamming-repair-preview-clear', () => {
      clearSummaryPreview();
    });

    document.addEventListener('hamming-repair-choice', (event) => {
      const { choice, distance, propagate } = event.detail || {};
      if (!distance || (choice !== 'yes' && choice !== 'no')) {
        return;
      }

      if (!propagate) {
        return;
      }

      clearSummaryPreview();

      const panes = getPanes();
      const summaryPane = panes[axiomPaneId];
      if (!summaryPane?.cy) {
        return;
      }

      const repairAxioms = choice === 'yes'
        ? distance.hamming_yes_repair
        : distance.hamming_no_repair;

      applyRepairAxiomsToSummary(summaryPane.cy, axiomPaneId, repairAxioms);

      document.dispatchEvent(new CustomEvent('summary-view-expand-decision-tree', {
        detail: { paneId: axiomPaneId },
      }));
    });

    document.addEventListener('summary-view-expand-decision-tree', () => {
      const panes = getPanes();
      const summaryPane = panes[axiomPaneId];
      const decisionPane = panes[firstPaneId];
      if (!summaryPane?.cy || !decisionPane?.cy || !decisionPane.cy.treeData) {
        return;
      }

      const summaryStates = getAxiomStatesForPane(axiomPaneId);
      const orderedDepthNodes = summaryPane.cy.nodes()
        .sort((a, b) => a.data('depth') - b.data('depth'))
        .toArray();

      const decisions = [];
      orderedDepthNodes.forEach((node) => {
        const state = summaryStates[node.id()];
        if (state === AXIOM_STATES.KEPT) {
          decisions.push('keep');
          return;
        }
        if (state === AXIOM_STATES.REMOVED) {
          decisions.push('remove');
          return;
        }
      });

      if (decisions.length === 0) {
        return;
      }

      const tree = decisionPane.cy.treeData;
      const targetIds = new Set(tree.edges.map(e => e.target));
      const rootNode = tree.nodes.find(node => !targetIds.has(node.id));
      if (!rootNode) {
        return;
      }

      let currentNodeId = rootNode.nodeId;

      decisions.forEach((edgeType) => {
        expandNodeByType(decisionPane.cy, currentNodeId, edgeType);

        const nextEdge = tree.edges.find(
          edge => edge.source === `node-${currentNodeId}` && edge.type === edgeType,
        );
        if (!nextEdge) {
          return;
        }
        const nextNode = tree.nodes.find(node => node.id === nextEdge.target);
        if (!nextNode) {
          return;
        }
        currentNodeId = nextNode.nodeId;
      });

      const targetNode = decisionPane.cy.getElementById(`node-${currentNodeId}`);
      if (targetNode.length > 0) {
        decisionPane.cy.nodes().unselect();
        targetNode.select();
        decisionPane.cy.animate({
          center: { eles: targetNode },
          duration: 450,
        });
      }
    });

    console.log('DL Repair Project initialized successfully');
  } catch (error) {
    console.error('Error initializing DL Repair project:', error);
    showErrorMessage('Failed to initialize DL Repair project: ' + error.message);
  }
}

async function updateDecisionTreePCP(pane, selectedNodeIds) {
  if (!pane || !pane.cy) {
    return;
  }

  const DECISION_TREE_PLOT_MODE = {
    PCP: 'pcp',
    STAR: 'star',
  };
  const STAR_PLOT_COLORS = {
    yesStroke: '#2b8a3e',
    yesFill: '#f5fff5',
    noStroke: '#c92a2a',
    noFill: '#fff5f5',
  };

  const buildSeriesValues = (dimensions, row) => dimensions.map((dimension) => {
    const value = Number(row?.[dimension]);
    if (Number.isNaN(value)) {
      return 0;
    }
    return Math.max(0, Math.min(1, value));
  });

  const createStarPlotSvg = ({
    dimensions,
    series,
    width,
    height,
    title,
    showAxisLabels = false,
  }) => {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
    svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
    svg.classList.add('decision-tree-star-svg');

    const centerX = width / 2;
    const centerY = height / 2;
    const radius = Math.max(40, Math.min(width, height) / 2 - 40);
    const axisCount = Math.max(1, dimensions.length);

    const polarToCartesian = (angle, value) => {
      const scaled = value * radius;
      return {
        x: centerX + scaled * Math.cos(angle),
        y: centerY + scaled * Math.sin(angle),
      };
    };

    const append = (name, attrs = {}, parent = svg) => {
      const element = document.createElementNS('http://www.w3.org/2000/svg', name);
      Object.entries(attrs).forEach(([key, value]) => {
        element.setAttribute(key, String(value));
      });
      parent.appendChild(element);
      return element;
    };

    [0.25, 0.5, 0.75, 1].forEach((step) => {
      append('circle', {
        cx: centerX,
        cy: centerY,
        r: radius * step,
        fill: 'none',
        stroke: '#cfcfcf',
        'stroke-width': 1,
      });
    });

    dimensions.forEach((dimension, index) => {
      const angle = -Math.PI / 2 + (2 * Math.PI * index) / axisCount;
      const endpoint = polarToCartesian(angle, 1);

      append('line', {
        x1: centerX,
        y1: centerY,
        x2: endpoint.x,
        y2: endpoint.y,
        class: 'decision-tree-star-axis-line',
        'data-axis-name': dimension,
        'data-default-stroke': STAR_AXIS_DEFAULT_STROKE,
        'data-default-stroke-width': STAR_AXIS_DEFAULT_STROKE_WIDTH,
        stroke: STAR_AXIS_DEFAULT_STROKE,
        'stroke-width': STAR_AXIS_DEFAULT_STROKE_WIDTH,
      });

      if (showAxisLabels) {
        const labelPoint = polarToCartesian(angle, 1.09);
        const label = append('text', {
          x: labelPoint.x,
          y: labelPoint.y,
          class: 'decision-tree-star-axis-label',
          'data-axis-name': dimension,
          'text-anchor': endpoint.x >= centerX ? 'start' : 'end',
          'dominant-baseline': endpoint.y >= centerY ? 'hanging' : 'auto',
          'font-size': 10,
          'font-weight': 500,
          'data-default-font-weight': 500,
          fill: '#4b4b4b',
        });
        label.textContent = dimension;
        label.addEventListener('mouseenter', () => {
          highlightGlobalStarAxis(dimension);
        });
        label.addEventListener('mouseleave', () => {
          resetGlobalStarAxisHighlight();
        });
      }
    });

    const seriesElements = [];

    series.forEach((entry) => {
      if (!entry.values.length) {
        return;
      }
      const pointList = entry.values
        .map((value, index) => {
          const angle = -Math.PI / 2 + (2 * Math.PI * index) / axisCount;
          const position = polarToCartesian(angle, value);
          return `${position.x},${position.y}`;
        });
      const points = pointList.join(' ');
      const linePoints = [...pointList, pointList[0]].join(' ');

      const fillPolygon = append('polygon', {
        points,
        fill: entry.fill || 'none',
        'fill-opacity': entry.fillOpacity ?? 0.12,
        stroke: 'none',
      });
      const strokePolyline = append('polyline', {
        points: linePoints,
        fill: 'none',
        stroke: entry.stroke,
        'stroke-width': entry.strokeWidth ?? 2,
        'stroke-dasharray': entry.dashArray || '0',
        'stroke-linejoin': 'round',
      });

      const style = {
        fill: entry.fill || 'none',
        fillOpacity: entry.fillOpacity ?? 0.12,
        stroke: entry.stroke,
        strokeWidth: entry.strokeWidth ?? 2,
        dashArray: entry.dashArray || '0',
      };
      fillPolygon.__seriesStyle = style;
      strokePolyline.__seriesStyle = style;
      seriesElements.push({
        fillPolygon,
        strokePolyline,
        style,
      });
    });

    if (title) {
      const titleText = append('text', {
        x: 8,
        y: 14,
        'text-anchor': 'start',
        'font-size': 12,
        'font-weight': 600,
        fill: '#2f2f2f',
      });
      titleText.textContent = title;
    }

    svg.__seriesElements = seriesElements;

    return svg;
  };

  const ensurePlotToggle = (mode, showAxisLabels) => {
    const detailElement = document.getElementById(pane.details);
    if (!detailElement) {
      return;
    }

    let toggle = detailElement.querySelector('.decision-tree-plot-toggle');
    if (!toggle) {
      toggle = document.createElement('div');
      toggle.className = 'decision-tree-plot-toggle';
      detailElement.appendChild(toggle);
    }

    toggle.innerHTML = `
      <div class="decision-tree-plot-toggle-row">
        <button class="decision-tree-plot-toggle-btn ${mode === DECISION_TREE_PLOT_MODE.PCP ? 'active' : ''}" data-mode="${DECISION_TREE_PLOT_MODE.PCP}">PCP</button>
        <button class="decision-tree-plot-toggle-btn ${mode === DECISION_TREE_PLOT_MODE.STAR ? 'active' : ''}" data-mode="${DECISION_TREE_PLOT_MODE.STAR}">Star Plot</button>
      </div>
      ${mode === DECISION_TREE_PLOT_MODE.STAR ? `
      <label class="decision-tree-star-label-switch">
        <input type="checkbox" class="decision-tree-star-label-switch-input" ${showAxisLabels ? 'checked' : ''}>
        <span>Show axis labels</span>
      </label>
      ` : ''}
    `;

    toggle.querySelectorAll('.decision-tree-plot-toggle-btn').forEach((button) => {
      button.onclick = () => {
        const nextMode = button.getAttribute('data-mode');
        if (!nextMode || pane.cy.vars['pcp-visual-mode'].value === nextMode) {
          return;
        }
        pane.cy.vars['pcp-visual-mode'].value = nextMode;
        const currentSelectedIds = pane.cy.$('node:selected').map(n => n.data('nodeId'));
        updateDecisionTreePCP(pane, currentSelectedIds);
      };
    });

    const labelSwitch = toggle.querySelector('.decision-tree-star-label-switch-input');
    if (labelSwitch) {
      labelSwitch.onchange = () => {
        pane.cy.vars['star-show-axis-labels'].value = labelSwitch.checked;
        if (pane.cy.vars['pcp-visual-mode'].value !== DECISION_TREE_PLOT_MODE.STAR) {
          return;
        }
        const currentSelectedIds = pane.cy.$('node:selected').map(n => n.data('nodeId'));
        updateDecisionTreePCP(pane, currentSelectedIds);
      };
    }
  };

  const clearStarPlotView = () => {
    const detailElement = document.getElementById(pane.details);
    if (!detailElement) {
      return;
    }
    detailElement
      .querySelectorAll('.decision-tree-star-root')
      .forEach(element => element.remove());
  };

  const renderStarPlotView = (dimensions, byNodeRows, selectedIds, showAxisLabels = false) => {
    const detailElement = document.getElementById(pane.details);
    if (!detailElement) {
      return;
    }

    clearStarPlotView();
    const root = document.createElement('div');
    root.className = 'decision-tree-star-root';
    detailElement.appendChild(root);

    const selectedKeys = (selectedIds || [])
      .map(id => String(id))
      .filter(id => byNodeRows[id]);

    if (selectedKeys.length === 0 || dimensions.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'decision-tree-star-empty';
      empty.textContent = 'Select one or more nodes to view star plots.';
      root.appendChild(empty);
      return;
    }

    const previousOrder = (pane.cy.starPlotOrder || []).map(id => String(id));
    const selectedSet = new Set(selectedKeys);
    const orderedKeys = previousOrder
      .filter(id => selectedSet.has(id))
      .concat(selectedKeys.filter(id => !previousOrder.includes(id)));
    pane.cy.starPlotOrder = orderedKeys;

    const nodeLabelById = {};
    pane.cy.nodes().forEach((node) => {
      const nodeId = String(node.data('nodeId'));
      const label = node.data('label') || node.data('axiom');
      if (label) {
        nodeLabelById[nodeId] = String(label);
      }
    });

    const getNodeLabel = (nodeId) => nodeLabelById[String(nodeId)] || `Node ${nodeId}`;
    const cardById = {};

    const combinedSection = document.createElement('div');
    combinedSection.className = 'decision-tree-star-combined';

    const rootWidth = Math.max(360, detailElement.clientWidth - 40);
    const combinedWidth = Math.max(360, Math.min(1200, rootWidth));

    const combinedSeries = [];
    const combinedSeriesIndicesByNode = new Map();
    orderedKeys.forEach((nodeId) => {
      const rows = byNodeRows[nodeId] || {};
      const yesValues = buildSeriesValues(dimensions, rows.yes || {});
      const noValues = buildSeriesValues(dimensions, rows.no || {});
      const nodeLabel = getNodeLabel(nodeId);
      const startIndex = combinedSeries.length;
      combinedSeries.push(
        {
          label: `${nodeLabel} — yes`,
          values: yesValues,
          stroke: STAR_PLOT_COLORS.yesStroke,
          fill: STAR_PLOT_COLORS.yesFill,
          fillOpacity: 0.6,
          strokeWidth: 2,
        },
        {
          label: `${nodeLabel} — no`,
          values: noValues,
          stroke: STAR_PLOT_COLORS.noStroke,
          fill: STAR_PLOT_COLORS.noFill,
          fillOpacity: 0.55,
          strokeWidth: 2,
        },
      );
      combinedSeriesIndicesByNode.set(String(nodeId), [startIndex, startIndex + 1]);
    });

    const setHoveredDecisionTreeNode = (nodeId = null) => {
      pane.cy.$('node.starplot-hovered').removeClass('starplot-hovered');
      if (nodeId === null || nodeId === undefined) {
        return;
      }
      pane.cy.getElementById(`node-${nodeId}`).addClass('starplot-hovered');
    };

    const combinedSvg = createStarPlotSvg({
      dimensions,
      series: combinedSeries,
      width: combinedWidth,
      height: 340,
      title: 'Combined Star Plot (selected nodes)',
      showAxisLabels,
    });
    combinedSection.appendChild(combinedSvg);

    const setCombinedHoverState = (hoveredNodeId = null) => {
      const seriesEls = combinedSvg.__seriesElements || [];
      const hoveredIndices = hoveredNodeId
        ? combinedSeriesIndicesByNode.get(String(hoveredNodeId))
        : null;
      const hoveredSet = hoveredIndices ? new Set(hoveredIndices) : null;

      seriesEls.forEach((seriesEl, polygonIndex) => {
        const { fillPolygon, strokePolyline, style: base } = seriesEl;
        if (!base) {
          return;
        }

        if (hoveredSet === null) {
          fillPolygon.setAttribute('fill', base.fill);
          fillPolygon.setAttribute('fill-opacity', String(base.fillOpacity));
          strokePolyline.setAttribute('stroke', base.stroke);
          strokePolyline.setAttribute('stroke-width', String(base.strokeWidth));
          strokePolyline.setAttribute('stroke-dasharray', String(base.dashArray));
          return;
        }

        if (hoveredSet.has(polygonIndex)) {
          fillPolygon.setAttribute('fill', base.fill);
          fillPolygon.setAttribute('fill-opacity', String(base.fillOpacity));
          strokePolyline.setAttribute('stroke', base.stroke);
          strokePolyline.setAttribute(
            'stroke-width',
            String(Math.max(base.strokeWidth, 3)),
          );
          strokePolyline.setAttribute('stroke-dasharray', String(base.dashArray));
          return;
        }

        fillPolygon.setAttribute('fill', '#f3f3f3');
        fillPolygon.setAttribute('fill-opacity', '0.16');
        strokePolyline.setAttribute('stroke', '#dddddd');
        strokePolyline.setAttribute('stroke-width', '1.5');
        strokePolyline.setAttribute('stroke-dasharray', '0');
      });

      if (hoveredSet === null) {
        seriesEls.forEach(({ fillPolygon }) => {
          fillPolygon.parentNode?.appendChild(fillPolygon);
        });
        seriesEls.forEach(({ strokePolyline }) => {
          strokePolyline.parentNode?.appendChild(strokePolyline);
        });
        return;
      }

      hoveredIndices.forEach((hoveredIndex) => {
        const hovered = seriesEls[hoveredIndex];
        if (hovered) {
          hovered.fillPolygon.parentNode?.appendChild(hovered.fillPolygon);
          hovered.strokePolyline.parentNode?.appendChild(hovered.strokePolyline);
        }
      });
    };
    root.appendChild(combinedSection);

    const gridTitle = document.createElement('div');
    gridTitle.className = 'decision-tree-star-grid-title';
    gridTitle.textContent = 'Per-node Star Plot Grid (drag to reorder)';
    root.appendChild(gridTitle);

    const grid = document.createElement('div');
    grid.className = 'decision-tree-star-grid';
    root.appendChild(grid);

    const setStarPlotHoverState = (hoveredNodeId = null) => {
      const normalizedId = hoveredNodeId === null || hoveredNodeId === undefined
        ? null
        : String(hoveredNodeId);
      const hasHover = normalizedId && combinedSeriesIndicesByNode.has(normalizedId);
      const effectiveId = hasHover ? normalizedId : null;

      setCombinedHoverState(effectiveId);
      setHoveredDecisionTreeNode(effectiveId);

      Object.entries(cardById).forEach(([nodeId, card]) => {
        card.classList.toggle('starplot-hovered-cell', effectiveId === nodeId);
      });
    };

    const applyGridOrder = () => {
      const scrollTop = root.scrollTop;
      const scrollLeft = root.scrollLeft;

      pane.cy.starPlotOrder.forEach((id) => {
        const card = cardById[String(id)];
        if (card) {
          grid.appendChild(card);
        }
      });

      root.scrollTop = scrollTop;
      root.scrollLeft = scrollLeft;
      requestAnimationFrame(() => {
        root.scrollTop = scrollTop;
        root.scrollLeft = scrollLeft;
      });
    };

    const reorder = (draggedId, targetId) => {
      if (!draggedId || !targetId || draggedId === targetId) {
        return;
      }
      const order = [...pane.cy.starPlotOrder.map(id => String(id))];
      const fromIndex = order.indexOf(draggedId);
      const toIndex = order.indexOf(targetId);
      if (fromIndex < 0 || toIndex < 0) {
        return;
      }
      const [item] = order.splice(fromIndex, 1);
      order.splice(toIndex, 0, item);
      pane.cy.starPlotOrder = order;
      applyGridOrder();
    };

    orderedKeys.forEach((nodeId) => {
      const rows = byNodeRows[nodeId] || {};
      const nodeLabel = getNodeLabel(nodeId);
      const card = document.createElement('div');
      card.className = 'decision-tree-star-card';
      card.draggable = true;
      card.setAttribute('data-node-id', nodeId);
      cardById[String(nodeId)] = card;

      const header = document.createElement('div');
      header.className = 'decision-tree-star-card-header';
      header.textContent = nodeLabel;
      card.appendChild(header);

      card.addEventListener('mouseenter', () => {
        setStarPlotHoverState(nodeId);
      });
      card.addEventListener('mouseleave', () => {
        setStarPlotHoverState(null);
      });

      const plotsWrap = document.createElement('div');
      plotsWrap.className = 'decision-tree-star-card-plots';

      const yesSvg = createStarPlotSvg({
        dimensions,
        series: [
          {
            label: 'yes',
            values: buildSeriesValues(dimensions, rows.yes || {}),
            stroke: STAR_PLOT_COLORS.yesStroke,
            fill: STAR_PLOT_COLORS.yesFill,
            fillOpacity: 0.75,
          },
        ],
        width: 230,
        height: 190,
        title: undefined,
        showAxisLabels: false,
      });
      yesSvg.classList.add('decision-tree-star-svg-small');

      const noSvg = createStarPlotSvg({
        dimensions,
        series: [
          {
            label: 'no',
            values: buildSeriesValues(dimensions, rows.no || {}),
            stroke: STAR_PLOT_COLORS.noStroke,
            fill: STAR_PLOT_COLORS.noFill,
            fillOpacity: 0.72,
          },
        ],
        width: 230,
        height: 190,
        title: undefined,
        showAxisLabels: false,
      });
      noSvg.classList.add('decision-tree-star-svg-small');

      plotsWrap.appendChild(yesSvg);
      plotsWrap.appendChild(noSvg);
      card.appendChild(plotsWrap);

      card.addEventListener('dragstart', (event) => {
        event.dataTransfer?.setData('text/plain', nodeId);
        event.dataTransfer.effectAllowed = 'move';
        card.classList.add('dragging');
      });

      card.addEventListener('dragend', () => {
        card.classList.remove('dragging');
      });

      card.addEventListener('dragover', (event) => {
        event.preventDefault();
        card.classList.add('drag-over');
      });

      card.addEventListener('dragleave', () => {
        card.classList.remove('drag-over');
      });

      card.addEventListener('drop', (event) => {
        event.preventDefault();
        card.classList.remove('drag-over');
        const draggedId = event.dataTransfer?.getData('text/plain');
        reorder(draggedId, nodeId);
      });

      grid.appendChild(card);
    });

    setStarPlotHoverState(null);
    return {
      setHoveredNode: (nodeId = null) => {
        setStarPlotHoverState(nodeId);
      },
    };
  };

  const normalizeToUnit = (value) => {
    const numeric = Number(value);
    if (Number.isNaN(numeric)) {
      return null;
    }
    const normalized = numeric > 1 ? numeric / 100 : numeric;
    return Math.max(0, Math.min(1, normalized));
  };

  const paneNodeIds = pane.cy.nodes().map(n => n.data('nodeId'));
  if (!paneNodeIds || paneNodeIds.length === 0) {
    if (pane.cy.pcp) {
      pane.cy.pcp.destroy();
      pane.cy.pcp = undefined;
    }
    return;
  }

  const selectedSet = new Set(selectedNodeIds || []);
  pane.cy.vars['pcp-visual-mode'] ||= { value: DECISION_TREE_PLOT_MODE.STAR };
  pane.cy.vars['star-show-axis-labels'] ||= { value: true };

  const probabilities = await Promise.all(
    paneNodeIds.map(nodeId => dlRepairApi.getImpactProbabilities(nodeId)),
  );

  const rows = [];
  const stats = {};
  const byNodeRows = {};
  paneNodeIds.forEach((nodeId, index) => {
    const yesValues = probabilities[index]?.yes;
    const noValues = probabilities[index]?.no;

    const buildRow = (values, suffix, colorVar) => {
      if (!values || typeof values !== 'object') {
        return null;
      }
      const row = {
        id: `node-${nodeId}-${suffix}`,
        linkedId: `node-${nodeId}`,
        _color: colorVar,
        _selected: selectedSet.has(nodeId),
      };

      Object.entries(values).forEach(([key, value]) => {
        const normalizedValue = normalizeToUnit(value);
        if (normalizedValue === null) {
          return;
        }
        row[key] = normalizedValue;
        stats[key] ||= { min: 0, max: 1 };
      });

      return row;
    };

    const yesRow = buildRow(yesValues, 'yes', '--pcp-yes');
    const noRow = buildRow(noValues, 'no', '--pcp-no');

    byNodeRows[String(nodeId)] = {
      yes: yesRow,
      no: noRow,
    };

    if (yesRow && noRow) {
      const overlapAxioms = new Set();
      Object.keys(yesRow).forEach((axiom) => {
        if (!axiom.startsWith('_') && axiom !== 'id' && axiom !== 'linkedId') {
          if (noRow[axiom] !== undefined && yesRow[axiom] === noRow[axiom]) {
            overlapAxioms.add(axiom);
          }
        }
      });

      if (overlapAxioms.size > 0) {
        yesRow._overlapAxioms = overlapAxioms;
        noRow._overlapAxioms = overlapAxioms;
      }

      rows.push(yesRow);
      rows.push(noRow);
    } else if (yesRow) {
      rows.push(yesRow);
    } else if (noRow) {
      rows.push(noRow);
    }
  });

  const pld = {};
  Object.keys(stats).forEach((key) => {
    pld[key] = {
      type: 'number',
      min: 0,
      max: 1,
      prop: 'impact1',
    };
  });

  const mode = pane.cy.vars['pcp-visual-mode'].value;
  const showAxisLabels = !!pane.cy.vars['star-show-axis-labels'].value;
  ensurePlotToggle(mode, showAxisLabels);

  if (pane.cy.pcp) {
    pane.cy.pcp.destroy();
    pane.cy.pcp = undefined;
  }

  if (mode === DECISION_TREE_PLOT_MODE.STAR) {
    let starPlotView = renderStarPlotView(
      Object.keys(pld),
      byNodeRows,
      selectedNodeIds || [],
      showAxisLabels,
    );
    pane.cy.pcp = {
      destroy: () => {
        clearStarPlotView();
      },
      redraw: () => {
        starPlotView = renderStarPlotView(
          Object.keys(pld),
          byNodeRows,
          selectedNodeIds || [],
          showAxisLabels,
        );
      },
      getSelection: () => {
        return [];
      },
      getOrder: () => {
        return [];
      },
      setHoveredNode: (nodeId = null) => {
        starPlotView?.setHoveredNode?.(nodeId);
      },
    };
    return;
  }

  clearStarPlotView();

  if (rows.length === 0) {
    return;
  }

  pane.cy.pcp = parallelCoords(
    pane,
    rows,
    {
      data_id: 'id',
      nominals: [],
      booleans: [],
      numbers: Object.keys(pld),
      pld,
      preselected: selectedSet.size,
      forceCompactDirection: true,
    },
  );
}

function generateProbabilitiesBarChart(probabilities) {
  if (!probabilities || (!probabilities.yes && !probabilities.no)) {
    return '<p>No probabilities data available</p>';
  }

  const formatPercent = (value) => `${Number((value * 100).toFixed(2)).toString()}%`;

  const normalizeToUnit = (value) => {
    const numeric = Number(value);
    if (Number.isNaN(numeric)) {
      return 0;
    }
    const normalized = numeric > 1 ? numeric / 100 : numeric;
    return Math.max(0, Math.min(1, normalized));
  };

  const isNoRepairValue = (value) => {
    if (typeof value !== 'string') {
      return false;
    }
    return value.trim().toLowerCase() === 'no repair!';
  };

  const yesUnavailable = isNoRepairValue(probabilities.yes);
  const noUnavailable = isNoRepairValue(probabilities.no);

  const yesData = !yesUnavailable && probabilities.yes && typeof probabilities.yes === 'object'
    ? probabilities.yes
    : {};
  const noData = !noUnavailable && probabilities.no && typeof probabilities.no === 'object'
    ? probabilities.no
    : {};
  
  // Get all unique axioms
  const allAxioms = new Set([...Object.keys(yesData), ...Object.keys(noData)]);

  const escapeHtml = (value) => String(value)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  const escapeSingleQuotedJs = (value) => String(value)
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'");

  const createMiniStarAxisIcon = (axiom, dimensions) => {
    const iconSize = 24;
    const center = iconSize / 2;
    const radius = 9.2;
    const polygonScale = 1;
    const axisCount = Math.max(1, dimensions.length);

    const getPoint = (angle, scale = 1) => ({
      x: center + radius * scale * Math.cos(angle),
      y: center + radius * scale * Math.sin(angle),
    });

    const axisLines = dimensions.map((dimension, index) => {
      const angle = -Math.PI / 2 + (2 * Math.PI * index) / axisCount;
      const endpoint = getPoint(angle);
      const isTargetAxis = dimension === axiom;
      const defaultStroke = isTargetAxis ? STAR_AXIS_HIGHLIGHT_STROKE : STAR_AXIS_DEFAULT_STROKE;
      const defaultStrokeWidth = isTargetAxis ? '1.8' : STAR_AXIS_DEFAULT_STROKE_WIDTH;
      const defaultOpacity = isTargetAxis ? '1' : '0.45';

      return `<line class="decision-tree-star-axis-line" data-axis-name="${escapeHtml(dimension)}" data-default-stroke="${defaultStroke}" data-default-stroke-width="${defaultStrokeWidth}" x1="${center}" y1="${center}" x2="${endpoint.x}" y2="${endpoint.y}" stroke="${defaultStroke}" stroke-width="${defaultStrokeWidth}" stroke-opacity="${defaultOpacity}" />`;
    }).join('');

    const polygonPoints = dimensions.map((dimension, index) => {
      const angle = -Math.PI / 2 + (2 * Math.PI * index) / axisCount;
      const point = getPoint(angle, polygonScale);
      return `${point.x},${point.y}`;
    }).join(' ');

    const escapedAxiomForJs = escapeSingleQuotedJs(axiom);
    return `<span title="Highlight ${escapeHtml(axiom)} axis in star plots" style="display: inline-flex; align-items: center; justify-content: center; width: 26px; height: 26px; cursor: pointer; flex-shrink: 0;" onmouseenter="window.dlRepairHighlightStarAxis && window.dlRepairHighlightStarAxis('${escapedAxiomForJs}')" onmouseleave="window.dlRepairClearStarAxisHighlight && window.dlRepairClearStarAxisHighlight()"><svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true" style="display: block;"><polygon points="${polygonPoints}" fill="#f4f4f4" fill-opacity="0.55" stroke="#d1d1d1" stroke-width="0.6"></polygon>${axisLines}</svg></span>`;
  };

  const renderAxiomLabelWithIcon = (axiom, dimensions, textColor = null) => {
    const colorStyle = textColor ? ` color: ${textColor}; font-weight: 600;` : '';
    const escapedAxiomForJs = escapeSingleQuotedJs(axiom);
    return `<div style="display: flex; align-items: center; gap: 6px; font-size: 13px; margin-bottom: 4px; word-wrap: break-word;${colorStyle}">${createMiniStarAxisIcon(axiom, dimensions)}<span style="min-width: 0; overflow-wrap: anywhere; cursor: pointer;" onmouseenter="this.style.fontWeight='700'; window.dlRepairHighlightStarAxis && window.dlRepairHighlightStarAxis('${escapedAxiomForJs}')" onmouseleave="this.style.fontWeight=''; window.dlRepairClearStarAxisHighlight && window.dlRepairClearStarAxisHighlight()">${axiom}</span></div>`;
  };

  const allAxiomDimensions = Array.from(allAxioms);
  
  let html = '<div style="font-family: monospace; font-size: 13px; border-bottom: 1px solid #d3d3d3; padding-bottom: 10px; margin-bottom: 14px; width: 100%; box-sizing: border-box;">';
  html += '<div style="display: flex; justify-content: space-between; align-items: center; cursor: pointer; width: 100%; box-sizing: border-box;" onclick="const content = document.getElementById(\'probabilities-content\'); const triangle = document.getElementById(\'probabilities-triangle\'); const isOpen = content.style.display !== \'none\'; content.style.display = isOpen ? \'none\' : \'block\'; triangle.style.transform = isOpen ? \'scaleX(1.35) rotate(180deg)\' : \'scaleX(1.35) rotate(0deg)\';">';
  html += '<h4 style="margin: 0; font-size: 17px;">Axiom Probabilities (keep/remove)</h4>';
  html += '<span id="probabilities-triangle" style="font-family: Arial, sans-serif; font-weight: 700; font-size: 13px; line-height: 1; display: inline-flex; align-items: center; justify-content: center; width: 13px; height: 13px; text-align: center; transform: scaleX(1.35) rotate(0deg); transform-origin: center center; flex-shrink: 0;">▴</span>';
  html += '</div>';
  html += '<div id="probabilities-content" style="display: block; padding-top: 8px; width: 100%; box-sizing: border-box;">';

  if (yesUnavailable || noUnavailable) {
    const warningParts = [];
    if (yesUnavailable && noUnavailable) {
      warningParts.push('keep/remove has No Repair');
    } else if (yesUnavailable) {
      warningParts.push('keep has No Repair');
    } else {
      warningParts.push('remove has No Repair');
    }
    html += `<div style="background: #fff3cd; border: 1px solid #ffe69c; color: #664d03; border-radius: 4px; padding: 8px 10px; margin-bottom: 10px; font-size: 12px;">${warningParts[0]}</div>`;
  }

  if (allAxioms.size === 0) {
    html += '<div style="font-size: 12px; color: #666;">No probability values available.</div>';
  }
  
  // Keep sorting functionality available, but do not invoke it for now.
  const ENABLE_AXIOM_PROBABILITIES_SORTING = false;

  // Categorize axioms: green, red, gray, blue, orange, bar charts
  const categorizedAxioms = Array.from(allAxioms).map(axiom => {
    const hasYes = Object.prototype.hasOwnProperty.call(yesData, axiom);
    const hasNo = Object.prototype.hasOwnProperty.call(noData, axiom);
    const yesValue = hasYes ? normalizeToUnit(yesData[axiom]) : 0;
    const noValue = hasNo ? normalizeToUnit(noData[axiom]) : 0;
    const hasBoth = hasYes && hasNo;

    const bothOne = hasBoth && yesValue === 1 && noValue === 1;
    const bothZero = hasBoth && yesValue === 0 && noValue === 0;
    const sameValue = hasBoth && yesValue === noValue;
    const yesOneNoZero = hasBoth && yesValue === 1 && noValue === 0;
    const yesZeroNoOne = hasBoth && yesValue === 0 && noValue === 1;

    let category = 5; // default: bar chart
    if (bothOne) {
      category = 0; // green
    } else if (bothZero) {
      category = 1; // red
    } else if (sameValue) {
      category = 2; // gray
    } else if (yesOneNoZero) {
      category = 3; // blue
    } else if (yesZeroNoOne) {
      category = 4; // orange
    }

    return { axiom, hasYes, hasNo, yesValue, noValue, category };
  });

  const sortCategorizedAxioms = (axioms) => axioms.sort((a, b) => a.category - b.category);

  if (ENABLE_AXIOM_PROBABILITIES_SORTING) {
    sortCategorizedAxioms(categorizedAxioms);
  }

  categorizedAxioms.forEach(({ axiom, hasYes, hasNo, yesValue, noValue, category }) => {
    const hasBoth = hasYes && hasNo;
    const bothOne = hasBoth && yesValue === 1 && noValue === 1;
    const bothZero = hasBoth && yesValue === 0 && noValue === 0;
    const sameValue = hasBoth && yesValue === noValue;
    const yesOneNoZero = hasBoth && yesValue === 1 && noValue === 0;
    const yesZeroNoOne = hasBoth && yesValue === 0 && noValue === 1;

    const shouldRenderSpecial = bothOne || bothZero || sameValue || yesOneNoZero || yesZeroNoOne;

    html += '<div style="margin-bottom: 12px;">';
    if (shouldRenderSpecial) {
      let axiomColor = '#6c757d';

      if (bothOne) {
        axiomColor = '#2b8a3e';
      } else if (bothZero) {
        axiomColor = '#c92a2a';
      } else if (yesOneNoZero) {
        axiomColor = '#1971c2';
      } else if (yesZeroNoOne) {
        axiomColor = '#e67700';
      }

      html += renderAxiomLabelWithIcon(axiom, allAxiomDimensions, axiomColor);

      html += `<div style="font-size: 11px; margin-top: 2px; color: ${axiomColor}; font-weight: 600;">keep: ${formatPercent(yesValue)} | remove: ${formatPercent(noValue)}</div>`;
    } else {
      html += renderAxiomLabelWithIcon(axiom, allAxiomDimensions);

      // Two-sided bar chart: left=remove (orange), right=keep (blue)
      html += '<div style="display: flex; align-items: stretch; width: 100%; height: 20px; border-radius: 3px; overflow: hidden; background-color: #f0f0f0; box-sizing: border-box; position: relative;">';
      html += `<div style="width: 50%; background-color: #f0f0f0; position: relative;"><div style="position: absolute; right: 0; top: 0; width: ${Math.max(0, Math.min(100, noValue * 100))}%; height: 100%; background-color: #F6D69C;"></div></div>`;
      html += `<div style="width: 50%; background-color: #f0f0f0; position: relative;"><div style="position: absolute; left: 0; top: 0; width: ${Math.max(0, Math.min(100, yesValue * 100))}%; height: 100%; background-color: #A6CAE1;"></div></div>`;
      html += '<div style="position: absolute; left: 50%; top: 0; transform: translateX(-50%); width: 1px; height: 100%; background-color: #000; z-index: 3;"></div>';
      html += `<div style="position: absolute; right: calc(50% + 6px); top: 50%; transform: translateY(-50%); font-size: 10px; font-weight: 600; color: #7a4a00; z-index: 4; pointer-events: none;">remove: ${formatPercent(noValue)}</div>`;
      html += `<div style="position: absolute; left: calc(50% + 6px); top: 50%; transform: translateY(-50%); font-size: 10px; font-weight: 600; color: #0b5a85; z-index: 4; pointer-events: none;">keep: ${formatPercent(yesValue)}</div>`;
      html += '</div>';
    }

    html += '</div>';
  });
  
  html += '</div>';
  html += '</div>';
  
  return html;
}

function generateHammingDistanceSection(distance) {
  if (!distance) {
    return '<p style="margin-top: 14px; font-size: 13px;">No hamming distance data available</p>';
  }

  const isNoRepairValue = (value) => {
    if (typeof value !== 'string') {
      return false;
    }
    return value.trim().toLowerCase() === 'no repair!';
  };

  const yesIsNoRepair = isNoRepairValue(distance.hamming_yes);
  const noIsNoRepair = isNoRepairValue(distance.hamming_no);

  const hammingYes = !yesIsNoRepair ? Number(distance.hamming_yes || 0) : 0;
  const hammingNo = !noIsNoRepair ? Number(distance.hamming_no || 0) : 0;
  const entailedYes = Array.isArray(distance.entailed_yes) ? distance.entailed_yes : [];
  const entailedBoth = Array.isArray(distance.entailed_both) ? distance.entailed_both : [];
  const entailedNo = Array.isArray(distance.entailed_no) ? distance.entailed_no : [];

  const formatUpTo4Decimals = (value) => Number(value.toFixed(4)).toString();
  
  const yesDisplay = yesIsNoRepair ? '(No Repair)' : `(<span style="color: #2b8a3e; font-weight: 600;">${formatUpTo4Decimals(hammingYes)}</span>)`;
  const noDisplay = noIsNoRepair ? '(No Repair)' : `(<span style="color: #c92a2a; font-weight: 600;">${formatUpTo4Decimals(hammingNo)}</span>)`;
  
  let compareSymbol = '=';
  if (!yesIsNoRepair && !noIsNoRepair) {
    if (hammingYes > hammingNo) {
      compareSymbol = '>';
    } else if (hammingYes < hammingNo) {
      compareSymbol = '<';
    }
  } else {
    compareSymbol = '-';
  }

  const renderAxiomList = (items) => {
    if (!items.length) {
      return '<div style="font-size: 12px; margin-top: 4px; color: #666;">No entailed axioms</div>';
    }
    return `<ul style="margin: 6px 0 0 16px; padding: 0; font-size: 12px;">${items
      .map(item => `<li style="margin-bottom: 4px; word-break: break-word;">${item}</li>`)
      .join('')}</ul>`;
  };

  const bothHoverKeep = "const bothBox=document.getElementById('hamming-both-box'); const bothLabel=document.getElementById('hamming-both-label'); if (bothBox) { bothBox.style.borderColor='#d9e8d9'; bothBox.style.background='#f5fff5'; } if (bothLabel) { bothLabel.style.color='#2b8a3e'; }";
  const bothHoverRemove = "const bothBox=document.getElementById('hamming-both-box'); const bothLabel=document.getElementById('hamming-both-label'); if (bothBox) { bothBox.style.borderColor='#f0d6d6'; bothBox.style.background='#fff5f5'; } if (bothLabel) { bothLabel.style.color='#c92a2a'; }";
  const bothHoverReset = "const bothBox=document.getElementById('hamming-both-box'); const bothLabel=document.getElementById('hamming-both-label'); if (bothBox) { bothBox.style.borderColor='#d9d9d9'; bothBox.style.background='#fafafa'; } if (bothLabel) { bothLabel.style.color='#555'; }";
  const propagateTip = 'Ctrl+click to propagate this choice to Summary View';

  let html = '<div style="margin-top: 18px; border-bottom: 1px solid #d3d3d3; padding-bottom: 10px; margin-bottom: 10px; width: 100%; box-sizing: border-box;">';
  html += '<div style="display: flex; justify-content: space-between; align-items: center; cursor: pointer; width: 100%; box-sizing: border-box;" onclick="const content = document.getElementById(\'hamming-content\'); const triangle = document.getElementById(\'hamming-triangle\'); const isOpen = content.style.display !== \'none\'; content.style.display = isOpen ? \'none\' : \'block\'; triangle.style.transform = isOpen ? \'scaleX(1.35) rotate(180deg)\' : \'scaleX(1.35) rotate(0deg)\';">';
  html += '<h4 style="margin: 0; font-size: 17px;">Hamming Distance</h4>';
  html += '<span id="hamming-triangle" style="font-family: Arial, sans-serif; font-weight: 700; font-size: 13px; line-height: 1; display: inline-flex; align-items: center; justify-content: center; width: 13px; height: 13px; text-align: center; transform: scaleX(1.35) rotate(0deg); transform-origin: center center; flex-shrink: 0;">▴</span>';
  html += '</div>';
  html += '<div id="hamming-content" style="display: block; padding-top: 8px; width: 100%; box-sizing: border-box;">';
  html += '<div style="font-size: 11px; color: #666; margin-bottom: 8px;">Tip: Ctrl+click on a distance choice to propagate it.</div>';
  html += `<div style="font-size: 13px; margin-bottom: 10px;"><span data-hamming-choice="yes" data-hamming-hover-target="yes" title="${propagateTip}" style="color: #2b8a3e; font-weight: 600; cursor: pointer;" onmouseover="${bothHoverKeep}" onmouseout="${bothHoverReset}">keep</span> <span data-hamming-choice="yes" data-hamming-hover-target="yes" title="${propagateTip}" style="cursor: pointer;" onmouseover="${bothHoverKeep}" onmouseout="${bothHoverReset}">${yesDisplay}</span> ${compareSymbol} <span data-hamming-choice="no" data-hamming-hover-target="yes" title="${propagateTip}" style="color: #c92a2a; font-weight: 600; cursor: pointer;" onmouseover="${bothHoverRemove}" onmouseout="${bothHoverReset}">remove</span> <span data-hamming-choice="no" data-hamming-hover-target="yes" title="${propagateTip}" style="cursor: pointer;" onmouseover="${bothHoverRemove}" onmouseout="${bothHoverReset}">${noDisplay}</span></div>`;
  html += '<div style="display: flex; flex-direction: column; gap: 10px;">';

  html += `<div data-hamming-choice="yes" style="border: 1px solid #d9e8d9; border-radius: 2px; padding: 11px 13px; background: #f5fff5; cursor: pointer;" onmouseover="${bothHoverKeep}" onmouseout="${bothHoverReset}">`;
  html += '<div style="font-weight: 600; font-size: 14px; color: #2b8a3e; display: inline-block;">keep</div>';
  html += renderAxiomList(entailedYes);
  html += '</div>';

  html += '<div id="hamming-both-box" style="border: 1px solid #d9d9d9; border-radius: 2px; padding: 11px 13px; background: #fafafa;">';
  html += '<div id="hamming-both-label" style="font-weight: 600; font-size: 14px; color: #555;">both</div>';
  html += renderAxiomList(entailedBoth);
  html += '</div>';

  html += `<div data-hamming-choice="no" style="border: 1px solid #f0d6d6; border-radius: 2px; padding: 11px 13px; background: #fff5f5; cursor: pointer;" onmouseover="${bothHoverRemove}" onmouseout="${bothHoverReset}">`;
  html += '<div style="font-weight: 600; font-size: 14px; color: #c92a2a; display: inline-block;">remove</div>';
  html += renderAxiomList(entailedNo);
  html += '</div>';

  html += '</div>';
  html += '</div>';
  html += '</div>';
  return html;
}

function generateNodeDetailsHTML(probabilities, distance) {
  return `<div style="width: 100%; box-sizing: border-box;">${generateProbabilitiesBarChart(probabilities)}${generateHammingDistanceSection(distance)}</div>`;
}

function bindHammingRepairClickActions(container, nodeId, pane) {
  if (!container) {
    return;
  }

  const clickableChoices = container.querySelectorAll('[data-hamming-choice]');
  const hoverPreviewChoices = container.querySelectorAll('[data-hamming-hover-target]');

  hoverPreviewChoices.forEach((element) => {
    element.onmouseenter = (event) => {
      event.stopPropagation();

      const choice = element.getAttribute('data-hamming-choice');
      if (!choice) {
        return;
      }

      document.dispatchEvent(new CustomEvent('hamming-repair-hover', {
        detail: {
          choice,
          nodeId,
          paneId: pane?.id,
          distance: container.__hammingDistanceData,
        },
      }));
    };

    element.onmouseleave = (event) => {
      event.stopPropagation();
      document.dispatchEvent(new CustomEvent('hamming-repair-hover-end', {
        detail: {
          paneId: pane?.id,
        },
      }));
    };
  });

  clickableChoices.forEach((element) => {
    element.onclick = (event) => {
      event.preventDefault();
      event.stopPropagation();

      const choice = element.getAttribute('data-hamming-choice');
      if (!choice) {
        return;
      }

      document.dispatchEvent(new CustomEvent('hamming-repair-choice', {
        detail: {
          choice,
          nodeId,
          paneId: pane?.id,
          propagate: !!(event.ctrlKey || event.metaKey),
          distance: container.__hammingDistanceData,
        },
      }));
    };
  });
}

function displayNodeDetails(html, nodeId, pane, hammingDistance = null) {
  // Always render in the sidebar section for DL Repair
  const detailsContainer = document.getElementById('dl-repair-details');
  if (detailsContainer) {
    detailsContainer.style.width = '100%';
    detailsContainer.style.boxSizing = 'border-box';
    detailsContainer.innerHTML = html;
    detailsContainer.__hammingDistanceData = hammingDistance;
    bindHammingRepairClickActions(detailsContainer, nodeId, pane);
  } else {
    // Create details container if it doesn't exist
    const newContainer = document.createElement('div');
    newContainer.id = 'dl-repair-details';
    newContainer.className = 'dl-repair-details';
    newContainer.style.padding = '16px';
    newContainer.style.overflow = 'auto';
    newContainer.style.width = '100%';
    newContainer.style.boxSizing = 'border-box';
    newContainer.innerHTML = html;
    newContainer.__hammingDistanceData = hammingDistance;
    bindHammingRepairClickActions(newContainer, nodeId, pane);

    // Add to config sidebar
    const configDiv = document.getElementById('config');
    if (configDiv) {
      configDiv.appendChild(newContainer);
    }
  }
}

function showErrorMessage(message) {
  const errorDiv = document.createElement('div');
  errorDiv.className = 'ui negative message';
  errorDiv.innerHTML = `<div class="header">Error</div><p>${message}</p>`;
  document.getElementById('container')?.appendChild(errorDiv);
}

async function start() {
  // Check project type
  PROJECT_TYPE = await checkProjectType();

  if (PROJECT_TYPE === 'dl-repair') {
    await startDLRepairProject();
  } else {
    startPrismProject();
  }
}

function startPrismProject() {
  socket.emitWithAck('MC_STATUS', PROJECT).then((data) => {
    setInfo(data.info);

    Promise.all([
      fetch(`${BACKEND}/${PROJECT}/initial`).then(r => r.json()),
      // fetch(BACKEND + PROJECT).then((res) => res.json()), // requests entire dataset
    ]).then((promises) => {
      const data = promises[0];
      const nodesIds = data.nodes
        .map((node) => node.id)
        .filter((id) => !id.startsWith('t'));

      info.initial = `#${nodesIds.join(', #')}`;

      if (document.getElementById('project-id')) {
        document.getElementById('project-id').innerHTML = info.id;
      }

      const firstPaneId = 'pane-0';
      const pane = spawnPane(
        { id: firstPaneId },
        nodesIds,
      );

      spawnGraph(pane, data, params);
    });
  });
}

export { info, setInfo, BACKEND, PROJECT_TYPE };
