import { cytoscape } from './imports/import-cytoscape.js';
import { spawnPane, destroyPanes } from './panes/panes.js';
import { COLORS, OUTLINES } from '../style/views/variables.js';

import dlRepairApi from '../utils/mock-dl-repair-api.js';

const NODE_STATE = {
  UNCHANGED: 'unchanged',
  ADDED: 'added',
  REMOVED: 'removed',
};
const CLASS_HIERARCHY_HEADER_HEIGHT = 32;

function getChildEntries(rawValue) {
  if (Array.isArray(rawValue)) {
    return rawValue;
  }

  if (rawValue && typeof rawValue === 'object') {
    return [rawValue];
  }

  return [];
}

function getNodeLabel(childObject) {
  if (!childObject || typeof childObject !== 'object') {
    return null;
  }

  const entries = Object.entries(childObject);
  if (entries.length === 0) {
    return null;
  }

  return entries[0][0];
}

function getNodeChildren(childObject) {
  if (!childObject || typeof childObject !== 'object') {
    return [];
  }

  const entries = Object.entries(childObject);
  if (entries.length === 0) {
    return [];
  }

  return getChildEntries(entries[0][1]);
}

function flattenHierarchy(hierarchyData) {
  const flattenedMap = new Map();

  function walkNode(label, nodeValue, parentSignature, labelOccurrence) {
    const signature = parentSignature
      ? `${parentSignature}>${label}#${labelOccurrence}`
      : `${label}#${labelOccurrence}`;

    flattenedMap.set(signature, {
      signature,
      label,
      parentSignature,
    });

    const childEntries = getChildEntries(nodeValue);
    const childLabelCounts = new Map();
    childEntries.forEach((childEntry, childIndex) => {
      const childLabel = getNodeLabel(childEntry);
      if (!childLabel) {
        return;
      }

      const nextLabelCount = (childLabelCounts.get(childLabel) || 0) + 1;
      childLabelCounts.set(childLabel, nextLabelCount);

      walkNode(
        childLabel,
        getNodeChildren(childEntry),
        signature,
        nextLabelCount,
      );
    });
  }

  const rootEntries = Object.entries(hierarchyData || {});
  const rootLabelCounts = new Map();
  rootEntries.forEach(([rootLabel, rootValue]) => {
    const nextRootLabelCount = (rootLabelCounts.get(rootLabel) || 0) + 1;
    rootLabelCounts.set(rootLabel, nextRootLabelCount);
    walkNode(rootLabel, rootValue, null, nextRootLabelCount);
  });

  return flattenedMap;
}

function buildComparisonElements(initialHierarchy, modifiedHierarchy) {
  const initialMap = flattenHierarchy(initialHierarchy);
  const modifiedMap = flattenHierarchy(modifiedHierarchy);

  const allSignatures = new Set([
    ...initialMap.keys(),
    ...modifiedMap.keys(),
  ]);

  const signatureToNodeId = new Map();
  const nodes = [];
  const edges = [];

  let nodeCounter = 0;
  allSignatures.forEach((signature) => {
    signatureToNodeId.set(signature, `class-node-${nodeCounter}`);
    nodeCounter += 1;
  });

  allSignatures.forEach((signature) => {
    const initialNode = initialMap.get(signature);
    const modifiedNode = modifiedMap.get(signature);
    const nodeData = initialNode || modifiedNode;

    let state = NODE_STATE.UNCHANGED;
    if (!initialNode && modifiedNode) {
      state = NODE_STATE.ADDED;
    } else if (initialNode && !modifiedNode) {
      state = NODE_STATE.REMOVED;
    }

    nodes.push({
      data: {
        id: signatureToNodeId.get(signature),
        label: nodeData?.label || 'Unknown',
        state,
      },
      classes: 'class-hierarchy-node',
    });
  });

  const edgeSet = new Set();
  allSignatures.forEach((signature) => {
    const initialNode = initialMap.get(signature);
    const modifiedNode = modifiedMap.get(signature);
    const nodeData = initialNode || modifiedNode;
    const parentSignature = nodeData?.parentSignature;

    if (!parentSignature || !signatureToNodeId.has(parentSignature)) {
      return;
    }

    const sourceId = signatureToNodeId.get(parentSignature);
    const targetId = signatureToNodeId.get(signature);
    const edgeId = `${sourceId}->${targetId}`;

    if (edgeSet.has(edgeId)) {
      return;
    }

    edgeSet.add(edgeId);
    edges.push({
      data: {
        id: edgeId,
        source: sourceId,
        target: targetId,
      },
    });
  });

  return {
    nodes,
    edges,
  };
}

function createComparisonStylesheet() {
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
      selector: 'node.class-hierarchy-node',
      style: {
        label: 'data(label)',
        shape: 'rectangle',
        width: 160,
        height: 42,
        'font-size': 12,
        'font-family': 'monospace',
        'text-wrap': 'wrap',
        'text-max-width': '145px',
        'text-valign': 'center',
        'text-margin-y': '0.65px',
        'text-halign': 'center',
        color: COLORS.LIGHT_TEXT,
        'background-color': COLORS.NODE_COLOR,
        'text-outline-color': COLORS.NODE_COLOR,
        'text-outline-width': '2px',
        'text-outline-opacity': 0,
        'overlay-padding': '6px',
        'z-index': '10',
        'background-opacity': 1,
        'border-width': OUTLINES.width,
        'border-color': COLORS.NODE_COLOR,
      },
    },
    {
      selector: 'node.class-hierarchy-node:selected',
      style: {
        'border-color': COLORS.SELECTED_BORDER,
        'border-width': OUTLINES.width_selected,
        'border-style': 'double',
        'border-position': 'center',
      },
    },
    {
      selector: 'node[state = "added"]',
      style: {
        'background-color': '#f5fff5',
        'border-color': '#2b8a3e',
        color: '#2b8a3e',
        'text-outline-color': '#f5fff5',
        'text-outline-width': '0px',
      },
    },
    {
      selector: 'node[state = "removed"]',
      style: {
        'background-color': '#fff5f5',
        'border-color': '#c92a2a',
        color: '#c92a2a',
        'text-outline-color': '#fff5f5',
        'text-outline-width': '0px',
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
        'line-color': COLORS.EDGE_COLOR,
        'target-arrow-color': COLORS.EDGE_COLOR,
      },
    },
  ];
}

function hidePaneDetails(pane, container) {
  const detailsElement = document.getElementById(pane.details);
  if (detailsElement) {
    detailsElement.style.display = 'none';
  }

  const splitDragbarElement = container.nextElementSibling;
  if (splitDragbarElement?.classList.contains('split-dragbar')) {
    splitDragbarElement.style.display = 'none';
  }

  container.style.marginTop = `${CLASS_HIERARCHY_HEADER_HEIGHT}px`;
  container.style.height = `${Math.max(80, pane.height - CLASS_HIERARCHY_HEADER_HEIGHT)}px`;
}

function setPaneTitle(pane, nodeId, onLayoutChange) {
  const paneElement = document.getElementById(pane.id);
  if (!paneElement) {
    return;
  }

  let header = paneElement.querySelector('.class-hierarchy-pane-header');
  if (!header) {
    header = document.createElement('div');
    header.className = 'class-hierarchy-pane-header';
    paneElement.prepend(header);
  }

  header.style.position = 'absolute';
  header.style.top = '0';
  header.style.left = '0';
  header.style.right = '0';
  header.style.height = `${CLASS_HIERARCHY_HEADER_HEIGHT}px`;
  header.style.padding = '6px 10px';
  header.style.zIndex = '5';
  header.style.display = 'flex';
  header.style.alignItems = 'center';
  header.style.justifyContent = 'space-between';
  header.style.gap = '10px';
  header.style.background = '#f7f7f7';
  header.style.borderBottom = '1px solid #dcdcdc';
  header.style.color = '#555';
  header.style.fontSize = '12px';
  header.style.fontWeight = 'bold';
  header.style.boxSizing = 'border-box';

  header.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;width:100%;flex-wrap:nowrap;">
      <span style="flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">Class Hierarchy (Node ${nodeId})</span>
      <div style="display:flex;gap:6px;align-items:center;">
        <button type="button" data-layout-mode="vertical" style="font-size:11px;padding:2px 7px;border:1px solid #bfbfbf;background:#f7f7f7;color:#444;cursor:pointer;">Vertical</button>
        <button type="button" data-layout-mode="horizontal" style="font-size:11px;padding:2px 7px;border:1px solid #bfbfbf;background:#f7f7f7;color:#444;cursor:pointer;">Horizontal</button>
      </div>
    </div>
  `;

  const verticalBtn = header.querySelector('[data-layout-mode="vertical"]');
  const horizontalBtn = header.querySelector('[data-layout-mode="horizontal"]');

  const setActiveButton = (mode) => {
    [verticalBtn, horizontalBtn].forEach((button) => {
      if (!button) {
        return;
      }
      const isActive = button.getAttribute('data-layout-mode') === mode;
      button.style.background = isActive ? '#efefef' : '#f7f7f7';
      button.style.borderColor = isActive ? '#9d9d9d' : '#bfbfbf';
      button.style.color = '#444';
    });
  };

  setActiveButton('horizontal');

  if (verticalBtn) {
    verticalBtn.onclick = () => {
      setActiveButton('vertical');
      onLayoutChange?.('vertical');
    };
  }

  if (horizontalBtn) {
    horizontalBtn.onclick = () => {
      setActiveButton('horizontal');
      onLayoutChange?.('horizontal');
    };
  }
}

export async function openClassHierarchyPane(sourceCy, nodeId) {
  const hierarchyPayload = await dlRepairApi.getClassHierarchyDifference(nodeId);
  if (!hierarchyPayload || !hierarchyPayload.initialHierarchy || !hierarchyPayload.modifiedHierarchy) {
    console.error(`Hierarchy data not available for node ${nodeId}`);
    return null;
  }

  const sourcePaneId = sourceCy?.container()?.closest('.pane')?.id || 'pane-0';
  const newPane = spawnPane(
    {
      spawner: sourcePaneId,
      id: `class-hierarchy-${nodeId}-${Date.now()}`,
      newPanePosition: 'right',
    },
    [`class-hierarchy-${nodeId}`],
    [nodeId],
  );

  if (!newPane) {
    console.error('Failed to create class hierarchy pane');
    return null;
  }

  const container = document.getElementById(newPane.container);
  if (!container) {
    console.error('Failed to find class hierarchy pane container');
    return null;
  }

  hidePaneDetails(newPane, container);

  const elements = buildComparisonElements(
    hierarchyPayload.initialHierarchy,
    hierarchyPayload.modifiedHierarchy,
  );

  const cy = cytoscape({
    container,
    elements,
    style: createComparisonStylesheet(),
    layout: {
      name: 'dagre',
      rankDir: 'LR',
      nodeSep: 50,
      rankSep: 90,
      fit: true,
      padding: 20,
      animate: false,
    },
    minZoom: 0.2,
    maxZoom: 2.5,
    wheelSensitivity: 0.2,
  });

  const runLayout = (mode = 'vertical') => {
    const rankDir = mode === 'horizontal' ? 'LR' : 'TB';
    cy.layout({
      name: 'dagre',
      rankDir,
      nodeSep: 50,
      rankSep: 90,
      fit: true,
      padding: 20,
      animate: false,
    }).run();
  };

  setPaneTitle(newPane, nodeId, runLayout);

  const initialPositions = new Map();
  cy.nodes().forEach((node) => {
    const { x, y } = node.position();
    initialPositions.set(node.id(), { x, y });
  });

  if (cy.contextMenus) {
    cy.ctxmenu = cy.contextMenus({
      menuItems: [
        {
          id: 'fit-view',
          content: 'Fit to view',
          tooltipText: 'Fit graph to viewport',
          coreAsWell: true,
          onClickFunction: () => {
            cy.fit(undefined, 30);
          },
          hasTrailingDivider: true,
        },
        {
          id: 'reset-graph-layout',
          content: 'Reset graph layout',
          tooltipText: 'Reset node positions to initial layout',
          coreAsWell: true,
          onClickFunction: () => {
            cy.batch(() => {
              cy.nodes().forEach((node) => {
                const initialPosition = initialPositions.get(node.id());
                if (initialPosition) {
                  node.position(initialPosition);
                }
              });
            });
            cy.fit(undefined, 30);
          },
          hasTrailingDivider: false,
        },
        {
          id: 'close-pane',
          content: 'Close pane',
          tooltipText: 'Close this class hierarchy pane',
          coreAsWell: true,
          onClickFunction: () => {
            destroyPanes(newPane.id, { manualRemoval: true }).catch(error => {
              console.error(`Failed to close pane ${newPane.id}:`, error);
            });
          },
          hasTrailingDivider: false,
        },
      ],
    });
  }

  cy.fit(undefined, 30);
  newPane.cy = cy;

  return cy;
}
