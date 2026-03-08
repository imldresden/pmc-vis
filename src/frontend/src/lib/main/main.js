import { spawnPane, getPanes } from '../views/panes/panes.js';
import { params } from '../views/graph/layout-options/klay.js';
import { spawnGraph } from '../views/graph/node-link.js';
import { PROJECT } from '../utils/controls.js';
import { CONSTANTS } from '../utils/names.js';
import { socket } from '../views/imports/import-socket.js';
import { createDecisionTree, createInitialTree, expandNode } from '../views/decision-tree.js';
import { parallelCoords } from '../views/attributes/parallel-coords.js';
import dlRepairApi from '../utils/mock-dl-repair-api.js';

let BACKEND = import.meta.env.VITE_BACKEND_RESTFUL;
const DL_REPAIR_SIDEBAR_WIDTH_KEY = 'dl-repair-sidebar-width';
let dlRepairSidebarResizeInitialized = false;

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
        displayNodeDetails(html, nodeId, targetPane);
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

    // Add edge click handler for navigation
    document.addEventListener('decision-tree-edge-clicked', (event) => {
      const targetNodeId = event.detail.target;
      const edgeType = event.detail.type;
      console.log(`Navigate via ${edgeType} to node ${targetNodeId}`);

      // You can add navigation logic here if needed
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

  const probabilities = await Promise.all(
    paneNodeIds.map(nodeId => dlRepairApi.getImpactProbabilities(nodeId)),
  );

  const rows = [];
  const stats = {};
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

  if (rows.length === 0) {
    if (pane.cy.pcp) {
      pane.cy.pcp.destroy();
      pane.cy.pcp = undefined;
    }
    return;
  }

  const pld = {};
  Object.keys(stats).forEach((key) => {
    pld[key] = {
      type: 'number',
      min: 0,
      max: 1,
      prop: 'impact1',
    };
  });

  if (pane.cy.pcp) {
    pane.cy.pcp.destroy();
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

  const formatUpTo2Decimals = (value) => Number(value.toFixed(2)).toString();

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
  
  let html = '<div style="font-family: monospace; font-size: 13px; border-bottom: 1px solid #d3d3d3; padding-bottom: 10px; margin-bottom: 14px; width: 100%; box-sizing: border-box;">';
  html += '<div style="display: flex; justify-content: space-between; align-items: center; cursor: pointer; width: 100%; box-sizing: border-box;" onclick="const content = document.getElementById(\'probabilities-content\'); const triangle = document.getElementById(\'probabilities-triangle\'); const isOpen = content.style.display !== \'none\'; content.style.display = isOpen ? \'none\' : \'block\'; triangle.style.transform = isOpen ? \'scaleX(1.35) rotate(180deg)\' : \'scaleX(1.35) rotate(0deg)\';">';
  html += '<h4 style="margin: 0; font-size: 17px;">Axiom Probabilities (Yes/No)</h4>';
  html += '<span id="probabilities-triangle" style="font-family: Arial, sans-serif; font-weight: 700; font-size: 13px; line-height: 1; display: inline-flex; align-items: center; justify-content: center; width: 13px; height: 13px; text-align: center; transform: scaleX(1.35) rotate(0deg); transform-origin: center center; flex-shrink: 0;">▴</span>';
  html += '</div>';
  html += '<div id="probabilities-content" style="display: block; padding-top: 8px; width: 100%; box-sizing: border-box;">';

  if (yesUnavailable || noUnavailable) {
    const warningParts = [];
    if (yesUnavailable && noUnavailable) {
      warningParts.push('yes/no has No Repair');
    } else if (yesUnavailable) {
      warningParts.push('yes has No Repair');
    } else {
      warningParts.push('no has No Repair');
    }
    html += `<div style="background: #fff3cd; border: 1px solid #ffe69c; color: #664d03; border-radius: 4px; padding: 8px 10px; margin-bottom: 10px; font-size: 12px;">${warningParts[0]}</div>`;
  }

  if (allAxioms.size === 0) {
    html += '<div style="font-size: 12px; color: #666;">No probability values available.</div>';
  }
  
  allAxioms.forEach(axiom => {
    const hasYes = Object.prototype.hasOwnProperty.call(yesData, axiom);
    const hasNo = Object.prototype.hasOwnProperty.call(noData, axiom);
    const yesValue = hasYes ? normalizeToUnit(yesData[axiom]) : 0;
    const noValue = hasNo ? normalizeToUnit(noData[axiom]) : 0;

    let visualYesValue = yesValue;
    let visualNoValue = noValue;
    if (hasYes && hasNo && visualYesValue === visualNoValue && visualYesValue !== 0) {
      visualNoValue = Math.min(1, visualNoValue + 0.01);
      if (visualNoValue === visualYesValue) {
        visualYesValue = Math.max(0, visualYesValue - 0.01);
      }
    }

    const yesPercent = visualYesValue * 100;
    const noPercent = visualNoValue * 100;
    const yesSmaller = visualYesValue <= visualNoValue;

    html += '<div style="margin-bottom: 12px;">';
    html += `<div style="font-size: 12px; margin-bottom: 4px; word-wrap: break-word;">${axiom}</div>`;

    // Create horizontal stacked bar container
    html += '<div style="position: relative; height: 20px; background-color: #f0f0f0; border-radius: 3px; overflow: hidden; width: 100%; box-sizing: border-box;">';

    if (hasYes && hasNo) {
      if (yesSmaller) {
        html += `<div style="position: absolute; left: 0; top: 0; width: ${noPercent}%; height: 100%; background-color: #ff6b6b; z-index: 1;"></div>`;
        html += `<div style="position: absolute; left: 0; top: 0; width: ${yesPercent}%; height: 100%; background-color: #51cf66; z-index: 2;"></div>`;
      } else {
        html += `<div style="position: absolute; left: 0; top: 0; width: ${yesPercent}%; height: 100%; background-color: #51cf66; z-index: 1;"></div>`;
        html += `<div style="position: absolute; left: 0; top: 0; width: ${noPercent}%; height: 100%; background-color: #ff6b6b; z-index: 2;"></div>`;
      }
    } else if (hasYes) {
      html += `<div style="position: absolute; left: 0; top: 0; width: ${yesPercent}%; height: 100%; background-color: #51cf66; z-index: 1;"></div>`;
    } else if (hasNo) {
      html += `<div style="position: absolute; left: 0; top: 0; width: ${noPercent}%; height: 100%; background-color: #ff6b6b; z-index: 1;"></div>`;
    }

    html += '</div>';

    // Add value labels
    if (hasYes && hasNo) {
      html += `<div style="font-size: 11px; margin-top: 2px;"><span style="color: #2b8a3e; font-weight: 600;">Yes:</span> <span style="color: #2b8a3e; font-weight: 600;">${formatUpTo2Decimals(yesValue)}</span> | <span style="color: #c92a2a; font-weight: 600;">No:</span> <span style="color: #c92a2a; font-weight: 600;">${formatUpTo2Decimals(noValue)}</span></div>`;
    } else if (hasYes) {
      html += `<div style="font-size: 11px; margin-top: 2px;"><span style="color: #2b8a3e; font-weight: 600;">Yes:</span> <span style="color: #2b8a3e; font-weight: 600;">${formatUpTo2Decimals(yesValue)}</span></div>`;
    } else if (hasNo) {
      html += `<div style="font-size: 11px; margin-top: 2px;"><span style="color: #c92a2a; font-weight: 600;">No:</span> <span style="color: #c92a2a; font-weight: 600;">${formatUpTo2Decimals(noValue)}</span></div>`;
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

  let html = '<div style="margin-top: 18px; border-bottom: 1px solid #d3d3d3; padding-bottom: 10px; margin-bottom: 10px; width: 100%; box-sizing: border-box;">';
  html += '<div style="display: flex; justify-content: space-between; align-items: center; cursor: pointer; width: 100%; box-sizing: border-box;" onclick="const content = document.getElementById(\'hamming-content\'); const triangle = document.getElementById(\'hamming-triangle\'); const isOpen = content.style.display !== \'none\'; content.style.display = isOpen ? \'none\' : \'block\'; triangle.style.transform = isOpen ? \'scaleX(1.35) rotate(180deg)\' : \'scaleX(1.35) rotate(0deg)\';">';
  html += '<h4 style="margin: 0; font-size: 17px;">Hamming Distance</h4>';
  html += '<span id="hamming-triangle" style="font-family: Arial, sans-serif; font-weight: 700; font-size: 13px; line-height: 1; display: inline-flex; align-items: center; justify-content: center; width: 13px; height: 13px; text-align: center; transform: scaleX(1.35) rotate(0deg); transform-origin: center center; flex-shrink: 0;">▴</span>';
  html += '</div>';
  html += '<div id="hamming-content" style="display: block; padding-top: 8px; width: 100%; box-sizing: border-box;">';
  html += `<div style="font-size: 13px; margin-bottom: 10px;"><span style="color: #2b8a3e; font-weight: 600;">yes</span> ${yesDisplay} ${compareSymbol} <span style="color: #c92a2a; font-weight: 600;">no</span> ${noDisplay}</div>`;
  html += '<div style="display: flex; flex-direction: column; gap: 10px;">';

  html += '<div style="border: 1px solid #d9e8d9; border-radius: 2px; padding: 11px 13px; background: #f5fff5;">';
  html += '<div style="font-weight: 600; font-size: 14px; color: #2b8a3e; display: inline-block;">yes</div>';
  html += renderAxiomList(entailedYes);
  html += '</div>';

  html += '<div style="border: 1px solid #d9d9d9; border-radius: 2px; padding: 11px 13px; background: #fafafa;">';
  html += '<div style="font-weight: 600; font-size: 14px; color: #555;">both</div>';
  html += renderAxiomList(entailedBoth);
  html += '</div>';

  html += '<div style="border: 1px solid #f0d6d6; border-radius: 2px; padding: 11px 13px; background: #fff5f5;">';
  html += '<div style="font-weight: 600; font-size: 14px; color: #c92a2a; display: inline-block;">no</div>';
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

function displayNodeDetails(html, nodeId, pane) {
  // Always render in the sidebar section for DL Repair
  const detailsContainer = document.getElementById('dl-repair-details');
  if (detailsContainer) {
    detailsContainer.style.width = '100%';
    detailsContainer.style.boxSizing = 'border-box';
    detailsContainer.innerHTML = html;
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
