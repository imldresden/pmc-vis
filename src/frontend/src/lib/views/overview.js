import { overviewStylesheet } from '../style/views/cy-style.js';
import { h, t } from '../utils/utils.js';
import { cytoscape } from './imports/import-cytoscape.js';
import { socket } from './imports/import-socket.js';

let DISTANCE_BETWEEN_LEVELS = 120; // Default distance between levels in pixels
let DISTANCE_BETWEEN_NODES_IN_LEVEL = 100; // Default distance between nodes in pixels

// Helper function to get color for level (adapted from customLayout.js)
function getColorForLevel(level) {
  const colors = {
    0: '#e74c3c', // Red
    1: '#3498db', // Blue
    2: '#2ecc71', // Green
    3: '#f39c12', // Orange
    4: '#9b59b6', // Purple
    5: '#1abc9c', // Turquoise
  };
  return colors[level] || '#95a5a6'; // Default gray
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

      const AX = sourceNode.position('x');
      const AY = sourceNode.position('y');
      const BX = targetNode.position('x');
      const BY = targetNode.position('y');

      const P1Y = AY;
      const P1Item = sourceNode.data('item') || 1;
      // Color the edges based on the item
      const P1Color = getColorForLevel(P1Item);
      const P1X = BX - 10 * P1Item - 20;

      const P2Y = BY;
      const P2X = P1X;

      // Calculate distances from P1 and P2 to line AB
      // Line AB: from (AX, AY) to (BX, BY)
      // P1: (P1X, P1Y), P2: (P2X, P2Y)

      // Calculate the line length first
      const lineLength = Math.sqrt((BY - AY) ** 2 + (BX - AX) ** 2);

      // Distance from P1 to line AB (with sign)
      const distance1 = lineLength > 0
        ? ((BY - AY) * P1X - (BX - AX) * P1Y + BX * AY - BY * AX) / lineLength : 0;

      // Distance from P2 to line AB (with sign)
      const distance2 = lineLength > 0
        ? ((BY - AY) * P2X - (BX - AX) * P2Y + BX * AY - BY * AX) / lineLength : 0;

      // Calculate projections of P1 and P2 onto line AB
      // Projection formula: t = ((P - A) · (B - A)) / ||B - A||²
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

      edge.style('line-color', P1Color);
      edge.style('target-arrow-color', P1Color);
      // Apply custom segment distances and weights
      edge.style('segment-distances', [-validDistance1, -validDistance2]);
      edge.style('segment-weights', [validProjection1, validProjection2]);
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

// Function to apply custom layout (exact copy from customLayout.js)
function applyCustomLayout(cy) {
  const nodes = cy.nodes();

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

    // Each level becomes a column
    const columnX = levelNum * DISTANCE_BETWEEN_LEVELS; // Configurable spacing between columns

    // Stack nodes vertically in each column
    nodesInLevel.forEach((node, index) => {
      // calculate nodeY from bottom to top
      const nodeY = cy.height() - index * DISTANCE_BETWEEN_NODES_IN_LEVEL;

      node.position({
        x: columnX,
        y: nodeY,
      });
    });
  });

  // Apply custom segment distances to edges
  applyCustomSegmentDistances(cy);
}

// Create overview-specific layout params without auto-fit (not used anymore)
// const overviewParams = {
//   ...params,
//   fit: false,
// };

var isInitialized = false;

const $ = document.querySelector.bind(document);
const $overview_graph_config = $('#overview-graph-config');
const $overview_controls = $('#overview-controls');
window.addEventListener('load', () => {
  makeOverviewSettings();
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
  window.addEventListener('resize', () => applyCustomSegmentDistances(cy2));

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
      newPaneData.spawner.forEach((s, i) => {
        spawner.push({
          data: {
            id: newPaneData.spawner[i] + paneId,
            source: newPaneData.spawner[i],
            target: paneId,
            label: 'merged',
          },
        });
      });
    } else {
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

  const elements = {
    nodes: [
      {
        data: {
          id: paneId,
          label: paneId,
        },
        style: {
          'background-color': newPaneData.backgroundColor,
          opacity: 0.3,
          shape: 'rectangle',
          width: 4,
          height: 4,
        },
      },
    ],
    edges: spawner,
  };

  cy2.add(elements);

  // Calculate and set level and item data for the new node
  const newNode = cy2.getElementById(paneId);
  if (newNode.length > 0) {
    // Calculate level based on parent node
    let level = 0;
    if (newPaneData.spawner) {
      const parentNode = cy2.getElementById(newPaneData.spawner);
      if (parentNode.length > 0) {
        level = (parentNode.data('level') || 0) + 1;
      }
    }
    newNode.data('level', level);

    // Calculate item value (same logic as customLayout.js)
    const nodesAtLevel = cy2.nodes().filter(n => n.data('level') === level && n.id() !== paneId);
    const itemValue = nodesAtLevel.length + 1;
    newNode.data('item', itemValue);
  }

  cy2.nodes().forEach((node) => {
    const backgroundColor = node.style('background-color');
    // set node color one more time, because of a bug
    // (node color won't set after several expansions)
    node.style('background-color', backgroundColor);
  });

  // Apply custom layout after elements are added
  setTimeout(() => {
    applyCustomLayout(cy2);
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

  // Remove associated edges
  // cy2
  //   .edges(`[source="${nodeIdToRemove}"], [target="${nodeIdToRemove}"]`)
  //   .remove();

  // remove node
  cy2.remove('#' + nodeIdToRemove);
}

function bindListeners(cy2) {
  cy2.on('click', 'node', e => {
    var node = e.target;

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

  // Fit and Center buttons
  const $buttonFit = h(
    'button',
    { class: 'ui button', id: 'fit-button' },
    [h('i', { class: 'fa-solid fa-expand-arrows-alt button-icon' }, []), h('span', {}, [t('Fit')])],
  );
  const $buttonCenter = h(
    'button',
    { class: 'ui button', id: 'center-button' },
    [h('i', { class: 'fa-solid fa-crosshairs button-icon' }, []), h('span', {}, [t('Center')])],
  );

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

  // Fit and Center button event listeners
  $buttonFit.addEventListener('click', async () => {
    cy2.fit(undefined, 30);
  });
  $buttonCenter.addEventListener('click', async () => {
    cy2.center();
  });

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
  $buttons.appendChild($buttonMerge);
  $buttons.appendChild($buttonRemove);
  $buttons2.appendChild($buttonDuplicate);
  $buttons2.appendChild($buttonExport);
  $buttons3.appendChild($buttonExpand);
  $buttons3.appendChild($buttonCollapse);

  // Add fit and center buttons to the top of the visualization
  $overview_controls.appendChild($buttonFit);
  $overview_controls.appendChild($buttonCenter);

  // Add level distance configuration
  $levelDistanceConfig.appendChild($levelDistanceLabel);
  $levelDistanceConfig.appendChild($levelDistanceContainer);

  // Add node distance configuration
  const $nodeDistanceConfig = h('div', { class: 'param' }, []);
  $nodeDistanceConfig.appendChild($nodeDistanceLabel);
  $nodeDistanceConfig.appendChild($nodeDistanceContainer);

  // Add other buttons to the config section
  $overview_graph_config?.appendChild($levelDistanceConfig);
  $overview_graph_config?.appendChild($nodeDistanceConfig);
  $overview_graph_config?.appendChild($buttons3);
  $overview_graph_config?.appendChild($buttons);
  $overview_graph_config?.appendChild($buttons2);
}
