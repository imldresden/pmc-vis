import { h, t } from '../../../utils/utils.js';
import { LAYOUT_DIRECTIONS, LAYOUT_TYPES } from '../index.js';

// Function to render edge boxes (only for vertical layout)
export function renderEdgeBoxes(
  graphDataStore,
  cy,
  LAYOUT_DIRECTION,
  LAYOUT_TYPE,
) {
  // Don't render edge boxes if biofabric layout is active
  if (LAYOUT_TYPE === LAYOUT_TYPES.BIOFABRIC) {
    const edgeBoxesContainer = document.getElementById('edge-boxes-container');
    if (edgeBoxesContainer) {
      edgeBoxesContainer.style.display = 'none';
    }
    return;
  }

  const edgeBoxesContainer = document.getElementById('edge-boxes-container');
  if (!edgeBoxesContainer) return;

  // Clear existing boxes
  edgeBoxesContainer.innerHTML = '';

  const edges = graphDataStore.getAllEdges();
  if (edges.length === 0) {
    edgeBoxesContainer.style.display = 'none';
    return;
  }

  // Separate merge edges from regular edges
  const mergeEdges = [];
  const regularEdges = [];
  edges.forEach(edge => {
    const isMergeEdge = edge.classes === 'merge-edge' || edge.classes?.includes('merge-edge');
    if (isMergeEdge) {
      mergeEdges.push(edge);
    } else {
      regularEdges.push(edge);
    }
  });

  // Group merge edges by target node (so merge edges with same target share one box)
  // Then find the source node with smallest level for positioning
  const mergeEdgesByTarget = {};
  mergeEdges.forEach(edge => {
    const targetId = edge.target;
    mergeEdgesByTarget[targetId] ||= [];
    mergeEdgesByTarget[targetId].push(edge);
  });

  // For each merge group, find the source node with smallest level
  const mergeEdgesBySourceLevel = {};
  Object.keys(mergeEdgesByTarget).forEach(targetId => {
    const mergeEdgeGroup = mergeEdgesByTarget[targetId];
    if (mergeEdgeGroup.length === 0) return;

    // Find the source node with the smallest level
    let minLevel = Infinity;
    let minLevelSourceNode = null;
    mergeEdgeGroup.forEach(edge => {
      const sourceNode = graphDataStore.getNode(edge.source);
      if (sourceNode) {
        const sourceLevel = sourceNode.level || 0;
        if (sourceLevel < minLevel) {
          minLevel = sourceLevel;
          minLevelSourceNode = sourceNode;
        }
      }
    });

    if (minLevelSourceNode) {
      const sourceLevel = minLevelSourceNode.level || 0;
      mergeEdgesBySourceLevel[sourceLevel] ||= [];
      mergeEdgesBySourceLevel[sourceLevel].push({
        edges: mergeEdgeGroup,
        sourceNode: minLevelSourceNode,
        targetId: targetId,
      });
    }
  });

  // Group regular edges by source node level
  const edgesBySourceLevel = {};
  regularEdges.forEach(edge => {
    const sourceNode = graphDataStore.getNode(edge.source);
    if (sourceNode) {
      const sourceLevel = sourceNode.level || 0;
      edgesBySourceLevel[sourceLevel] ||= [];
      edgesBySourceLevel[sourceLevel].push(edge);
    }
  });

  if (LAYOUT_DIRECTION === LAYOUT_DIRECTIONS.HORIZONTAL) {
    // Horizontal layout: boxes rotated 90 degrees, positioned at source node x
    // Calculate minimum y position of all nodes in the graph
    const allNodes = graphDataStore.getAllNodes();
    let minY = Infinity;
    allNodes.forEach(node => {
      const cyNode = cy.getElementById(node.id);
      if (cyNode.length > 0) {
        const nodePos = cyNode.position();
        const nodeHeight = cyNode.height();
        const nodeY = nodePos.y - nodeHeight / 2; // Top of the node
        minY = Math.min(minY, nodeY);
      }
    });

    // The y position should be a little less than the minimum y of nodes in the graph
    const boxY = minY - 60; // 60px above the minimum y

    // Combine merge edges with regular edges by source level
    const allEdgesBySourceLevel = { ...edgesBySourceLevel };
    Object.keys(mergeEdgesBySourceLevel).forEach(sourceLevel => {
      allEdgesBySourceLevel[sourceLevel] ||= [];
      // Add merge edge groups as special entries
      mergeEdgesBySourceLevel[sourceLevel].forEach(mergeGroup => {
        allEdgesBySourceLevel[sourceLevel].push({ isMergeGroup: true, ...mergeGroup });
      });
    });

    // Process each group of edges (by source level)
    const sortedLevels = Object.keys(allEdgesBySourceLevel)
      .sort((a, b) => parseInt(a) - parseInt(b));
    sortedLevels.forEach(sourceLevel => {
      const edgeGroup = allEdgesBySourceLevel[sourceLevel];

      // Separate regular edges from merge groups
      const regularEdgesInLevel = edgeGroup.filter(item => !item.isMergeGroup);
      const mergeGroupsInLevel = edgeGroup.filter(item => item.isMergeGroup);

      // Sort regular edges by source node's item value
      regularEdgesInLevel.sort((a, b) => {
        const sourceA = graphDataStore.getNode(a.source);
        const sourceB = graphDataStore.getNode(b.source);
        const itemA = sourceA ? (sourceA.item || 0) : 0;
        const itemB = sourceB ? (sourceB.item || 0) : 0;
        return itemA - itemB;
      });

      // Sort merge groups by source node's item value
      mergeGroupsInLevel.sort((a, b) => {
        const itemA = a.sourceNode.item || 0;
        const itemB = b.sourceNode.item || 0;
        return itemA - itemB;
      });

      // Combine sorted arrays: merge groups first, then regular edges
      const allItems = [...mergeGroupsInLevel, ...regularEdgesInLevel];

      // Find the first item's source node position for positioning
      let firstBoxX;
      if (allItems.length > 0) {
        if (allItems[0].isMergeGroup) {
          const cyNode = cy.getElementById(allItems[0].sourceNode.id);
          firstBoxX = cyNode.length > 0 ? cyNode.position().x : 0;
        } else {
          const cyNode = cy.getElementById(allItems[0].source);
          firstBoxX = cyNode.length > 0 ? cyNode.position().x : 0;
        }
      } else {
        return; // Skip if no items
      }

      // Box width for horizontal spacing (boxes to the right of first box)
      const boxSpacing = 56; // Spacing between boxes

      // Create boxes for each item in this group
      allItems.forEach((item, index) => {
        const boxX = firstBoxX + index * boxSpacing;

        if (item.isMergeGroup) {
          // Handle merge group
          const mergeEdgeGroup = item.edges;
          const edgeIds = mergeEdgeGroup.map(e => e.id);
          const edgeIdsStr = edgeIds.join(',');

          // Use the first edge's label or create a combined label
          const firstEdge = mergeEdgeGroup[0];
          const edgeLabel = firstEdge.label || 'merged';

          const firstEdgeId = edgeIds[0];
          const currentNote = graphDataStore.getEdgeNote(firstEdgeId);

          const box = h('div', {
            class: 'edge-box edge-box-horizontal',
            'data-edge-id': edgeIdsStr,
            'data-is-merge': 'true',
            style: `position: absolute; left: ${boxX}px; top: ${boxY}px; transform: rotate(-45deg); transform-origin: left top;`,
          }, []);

          const labelPart = h('div', { class: 'edge-box-label', title: edgeLabel }, [t(edgeLabel)]);

          const noteInput = h('input', {
            type: 'text',
            class: 'edge-box-note-input',
            value: currentNote,
          }, []);

          noteInput.addEventListener('input', (e) => {
            graphDataStore.setEdgeNotes(edgeIds, e.target.value);
          });

          const notePart = h('div', { class: 'edge-box-note' }, [noteInput]);

          box.appendChild(labelPart);
          box.appendChild(notePart);

          box.addEventListener('mouseenter', () => {
            const selectedEdgeId = graphDataStore.getSelectedEdgeId();
            if (!edgeIds.includes(selectedEdgeId)) {
              edgeIds.forEach(edgeId => {
                const correspondingEdge = cy.getElementById(edgeId);
                if (correspondingEdge.length > 0) {
                  correspondingEdge.addClass('edge-highlighted');
                }
              });
              box.classList.add('edge-box-highlighted');
            }
          });

          box.addEventListener('mouseleave', () => {
            const selectedEdgeId = graphDataStore.getSelectedEdgeId();
            if (!edgeIds.includes(selectedEdgeId)) {
              edgeIds.forEach(edgeId => {
                const correspondingEdge = cy.getElementById(edgeId);
                if (correspondingEdge.length > 0) {
                  correspondingEdge.removeClass('edge-highlighted');
                }
              });
              box.classList.remove('edge-box-highlighted');
            }
          });

          box.addEventListener('click', (e) => {
            e.stopPropagation();
            graphDataStore.clearSelectedEdge();
            edgeIds.forEach(edgeId => {
              const edge = cy.getElementById(edgeId);
              if (edge.length > 0) {
                edge.addClass('edge-selected');
              }
            });
            box.classList.add('edge-box-selected');
            graphDataStore.setSelectedEdgeId(firstEdgeId);
          });

          edgeBoxesContainer.appendChild(box);
        } else {
          const edge = item;
          const edgeId = edge.id;
          const edgeLabel = edge.label || '';
          const currentNote = graphDataStore.getEdgeNote(edgeId);

          const box = h('div', {
            class: 'edge-box edge-box-horizontal',
            'data-edge-id': edgeId,
            style: `position: absolute; left: ${boxX}px; top: ${boxY}px; transform: rotate(-45deg); transform-origin: left top;`,
          }, []);

          const labelPart = h('div', { class: 'edge-box-label', title: edgeLabel }, [t(edgeLabel)]);

          const noteInput = h('input', {
            type: 'text',
            class: 'edge-box-note-input',
            value: currentNote,
          }, []);

          noteInput.addEventListener('input', (e) => {
            graphDataStore.setEdgeNote(edgeId, e.target.value);
          });

          const notePart = h('div', { class: 'edge-box-note' }, [noteInput]);

          box.appendChild(labelPart);
          box.appendChild(notePart);

          box.addEventListener('mouseenter', () => {
            const selectedEdgeId = graphDataStore.getSelectedEdgeId();
            if (selectedEdgeId !== edgeId) {
              const correspondingEdge = cy.getElementById(edgeId);
              if (correspondingEdge.length > 0) {
                correspondingEdge.addClass('edge-highlighted');
              }
              box.classList.add('edge-box-highlighted');
            }
          });

          box.addEventListener('mouseleave', () => {
            const selectedEdgeId = graphDataStore.getSelectedEdgeId();
            if (selectedEdgeId !== edgeId) {
              const correspondingEdge = cy.getElementById(edgeId);
              if (correspondingEdge.length > 0) {
                correspondingEdge.removeClass('edge-highlighted');
              }
              box.classList.remove('edge-box-highlighted');
            }
          });

          box.addEventListener('click', (e) => {
            e.stopPropagation();
            graphDataStore.setSelectedEdgeId(edgeId);
            const correspondingEdge = cy.getElementById(edgeId);
            if (correspondingEdge.length > 0) {
              correspondingEdge.addClass('edge-selected');
            }
            box.classList.add('edge-box-selected');
          });

          edgeBoxesContainer.appendChild(box);
        }
      });
    });
  } else {
    // Vertical layout: boxes in rows, positioned to the right of the graph
    // Calculate x position - place boxes to the right of the graph
    // Get the rightmost node position to determine where to place boxes
    const allNodes = graphDataStore.getAllNodes();
    let maxX = 0;
    allNodes.forEach(node => {
      const cyNode = cy.getElementById(node.id);
      if (cyNode.length > 0) {
        const nodePos = cyNode.position();
        const nodeWidth = cyNode.width();
        maxX = Math.max(maxX, nodePos.x + nodeWidth / 2);
      }
    });

    const boxX = maxX + 50; // 50px spacing from the rightmost node

    // Combine merge edges with regular edges by source level
    const allEdgesBySourceLevelVertical = { ...edgesBySourceLevel };
    Object.keys(mergeEdgesBySourceLevel).forEach(sourceLevel => {
      allEdgesBySourceLevelVertical[sourceLevel] ||= [];
      // Add merge edge groups as special entries
      mergeEdgesBySourceLevel[sourceLevel].forEach(mergeGroup => {
        allEdgesBySourceLevelVertical[sourceLevel].push({ isMergeGroup: true, ...mergeGroup });
      });
    });

    // Process each group of edges (by source level)
    const sortedLevels = Object.keys(allEdgesBySourceLevelVertical)
      .sort((a, b) => parseInt(a) - parseInt(b));
    sortedLevels.forEach(sourceLevel => {
      const edgeGroup = allEdgesBySourceLevelVertical[sourceLevel];

      // Separate regular edges from merge groups
      const regularEdgesInLevel = edgeGroup.filter(item => !item.isMergeGroup);
      const mergeGroupsInLevel = edgeGroup.filter(item => item.isMergeGroup);

      // Sort regular edges by source node's item value
      regularEdgesInLevel.sort((a, b) => {
        const sourceA = graphDataStore.getNode(a.source);
        const sourceB = graphDataStore.getNode(b.source);
        const itemA = sourceA ? (sourceA.item || 0) : 0;
        const itemB = sourceB ? (sourceB.item || 0) : 0;
        return itemA - itemB;
      });

      // Sort merge groups by source node's item value
      mergeGroupsInLevel.sort((a, b) => {
        const itemA = a.sourceNode.item || 0;
        const itemB = b.sourceNode.item || 0;
        return itemA - itemB;
      });

      // Combine sorted arrays: merge groups first, then regular edges
      const allItems = [...mergeGroupsInLevel, ...regularEdgesInLevel];

      // Find the first item's source node position for positioning
      let firstBoxY;
      if (allItems.length > 0) {
        if (allItems[0].isMergeGroup) {
          const cyNode = cy.getElementById(allItems[0].sourceNode.id);
          firstBoxY = cyNode.length > 0 ? cyNode.position().y : 0;
        } else {
          const cyNode = cy.getElementById(allItems[0].source);
          firstBoxY = cyNode.length > 0 ? cyNode.position().y : 0;
        }
      } else {
        return; // Skip if no items
      }

      // Box height for spacing (approximate, will be adjusted by actual box height)
      const boxHeight = 40;

      // Create boxes for each item in this group
      allItems.forEach((item, index) => {
        const boxY = firstBoxY + index * boxHeight;

        if (item.isMergeGroup) {
          // Handle merge group
          const mergeEdgeGroup = item.edges;
          const edgeIds = mergeEdgeGroup.map(e => e.id);
          const edgeIdsStr = edgeIds.join(',');

          // Use the first edge's label or create a combined label
          const firstEdge = mergeEdgeGroup[0];
          const edgeLabel = firstEdge.label || 'merged';

          const firstEdgeId = edgeIds[0];
          const currentNote = graphDataStore.getEdgeNote(firstEdgeId);

          const box = h('div', {
            class: 'edge-box',
            'data-edge-id': edgeIdsStr,
            'data-is-merge': 'true',
            style: `position: absolute; left: ${boxX}px; top: ${boxY}px;`,
          }, []);

          const labelPart = h('div', { class: 'edge-box-label', title: edgeLabel }, [t(edgeLabel)]);

          const noteInput = h('input', {
            type: 'text',
            class: 'edge-box-note-input',
            value: currentNote,
          }, []);

          noteInput.addEventListener('input', (e) => {
            graphDataStore.setEdgeNotes(edgeIds, e.target.value);
          });

          const notePart = h('div', { class: 'edge-box-note' }, [noteInput]);

          box.appendChild(labelPart);
          box.appendChild(notePart);

          box.addEventListener('mouseenter', () => {
            const selectedEdgeId = graphDataStore.getSelectedEdgeId();
            if (!edgeIds.includes(selectedEdgeId)) {
              edgeIds.forEach(edgeId => {
                const correspondingEdge = cy.getElementById(edgeId);
                if (correspondingEdge.length > 0) {
                  correspondingEdge.addClass('edge-highlighted');
                }
              });
              box.classList.add('edge-box-highlighted');
            }
          });

          box.addEventListener('mouseleave', () => {
            const selectedEdgeId = graphDataStore.getSelectedEdgeId();
            if (!edgeIds.includes(selectedEdgeId)) {
              edgeIds.forEach(edgeId => {
                const correspondingEdge = cy.getElementById(edgeId);
                if (correspondingEdge.length > 0) {
                  correspondingEdge.removeClass('edge-highlighted');
                }
              });
              box.classList.remove('edge-box-highlighted');
            }
          });

          box.addEventListener('click', (e) => {
            e.stopPropagation();
            graphDataStore.clearSelectedEdge();
            edgeIds.forEach(edgeId => {
              const edge = cy.getElementById(edgeId);
              if (edge.length > 0) {
                edge.addClass('edge-selected');
              }
            });
            box.classList.add('edge-box-selected');
            graphDataStore.setSelectedEdgeId(firstEdgeId);
          });

          edgeBoxesContainer.appendChild(box);
        } else {
          const edge = item;
          const edgeId = edge.id;
          const edgeLabel = edge.label || '';
          const currentNote = graphDataStore.getEdgeNote(edgeId);

          const box = h('div', {
            class: 'edge-box',
            'data-edge-id': edgeId,
            style: `position: absolute; left: ${boxX}px; top: ${boxY}px;`,
          }, []);

          const labelPart = h('div', { class: 'edge-box-label', title: edgeLabel }, [t(edgeLabel)]);

          const noteInput = h('input', {
            type: 'text',
            class: 'edge-box-note-input',
            value: currentNote,
          }, []);

          noteInput.addEventListener('input', (e) => {
            graphDataStore.setEdgeNote(edgeId, e.target.value);
          });

          const notePart = h('div', { class: 'edge-box-note' }, [noteInput]);

          box.appendChild(labelPart);
          box.appendChild(notePart);

          box.addEventListener('mouseenter', () => {
            const selectedEdgeId = graphDataStore.getSelectedEdgeId();
            if (selectedEdgeId !== edgeId) {
              const correspondingEdge = cy.getElementById(edgeId);
              if (correspondingEdge.length > 0) {
                correspondingEdge.addClass('edge-highlighted');
              }
              box.classList.add('edge-box-highlighted');
            }
          });

          box.addEventListener('mouseleave', () => {
            const selectedEdgeId = graphDataStore.getSelectedEdgeId();
            if (selectedEdgeId !== edgeId) {
              const correspondingEdge = cy.getElementById(edgeId);
              if (correspondingEdge.length > 0) {
                correspondingEdge.removeClass('edge-highlighted');
              }
              box.classList.remove('edge-box-highlighted');
            }
          });

          box.addEventListener('click', (e) => {
            e.stopPropagation();
            graphDataStore.setSelectedEdgeId(edgeId);
            const correspondingEdge = cy.getElementById(edgeId);
            if (correspondingEdge.length > 0) {
              correspondingEdge.addClass('edge-selected');
            }
            box.classList.add('edge-box-selected');
          });

          edgeBoxesContainer.appendChild(box);
        }
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

// Function to calculate level spacing adjustments based on edge note counts
export function calculateLevelSpacingAdjustments(graphDataStore, cy, LAYOUT_DIRECTION) {
  const edges = graphDataStore.getAllEdges();
  const levelAdjustments = {}; // Maps level -> spacing adjustment needed before this level

  // Group edges by source node level
  const edgesBySourceLevel = {};
  edges.forEach(edge => {
    const sourceNode = graphDataStore.getNode(edge.source);
    if (sourceNode) {
      const sourceLevel = sourceNode.level || 0;
      edgesBySourceLevel[sourceLevel] ||= [];
      edgesBySourceLevel[sourceLevel].push(edge);
    }
  });

  // Calculate adjustments for each level transition
  Object.keys(edgesBySourceLevel).forEach(sourceLevel => {
    const edgeGroup = edgesBySourceLevel[sourceLevel];

    // If this group has more than 3 edge notes, add extra spacing
    if (edgeGroup.length > 3) {
      // Find all target levels for edges in this group
      const targetLevels = new Set();
      edgeGroup.forEach(edge => {
        const targetNode = graphDataStore.getNode(edge.target);
        if (targetNode) {
          const targetLevel = targetNode.level || 0;
          targetLevels.add(targetLevel);
        }
      });

      // Calculate extra spacing needed (additional space per edge note beyond 3)
      const extraSpacing = (edgeGroup.length - 3)
        * (LAYOUT_DIRECTION === LAYOUT_DIRECTIONS.VERTICAL ? 20 : 60);

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
  const allLevels = graphDataStore.getAllNodes().map(n => parseInt(n.level || 0));
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

// Function to apply compact layout
export function applyCompactLayout(
  graphDataStore,
  cy,
  LAYOUT_DIRECTION,
  DISTANCE_BETWEEN_LEVELS,
  DISTANCE_BETWEEN_NODES_IN_LEVEL,
  INITIAL_HORIZONTAL_POSITION,
  INITIAL_VERTICAL_POSITION,
  applyCustomSegmentDistances,
  updateCyOverviewDimensions,
  renderEdgeBoxes,
  calculateLevelSpacingAdjustments,
  LAYOUT_TYPE,
) {
  const nodes = graphDataStore.getAllNodes();

  // Calculate level spacing adjustments based on edge note counts
  const levelSpacingAdjustments = calculateLevelSpacingAdjustments(
    graphDataStore,
    cy,
    LAYOUT_DIRECTION,
  );

  // Group nodes by level
  const levelGroups = {};
  nodes.forEach(node => {
    const level = node.level || 0;
    levelGroups[level] ||= [];
    levelGroups[level].push(node);
  });

  // Position nodes based on their level
  Object.keys(levelGroups).forEach(level => {
    const levelNum = parseInt(level);
    const nodesInLevel = levelGroups[level];

    // Sort nodes by their item value to maintain consistent order
    nodesInLevel.sort((a, b) => {
      const itemA = a.item || 0;
      const itemB = b.item || 0;
      return itemA - itemB;
    });

    // Get spacing adjustment for this level
    const spacingAdjustment = levelSpacingAdjustments[levelNum] || 0;

    if (LAYOUT_DIRECTION === LAYOUT_DIRECTIONS.HORIZONTAL) {
      // Horizontal layout: levels are columns (x-axis), nodes stacked vertically (y-axis)
      // Add spacing adjustment to push levels with many edge notes
      const columnX = levelNum * DISTANCE_BETWEEN_LEVELS + spacingAdjustment;

      // Stack nodes vertically in each column
      nodesInLevel.forEach((node, index) => {
        // calculate nodeY from bottom to top
        const nodeY = cy.height() - index * DISTANCE_BETWEEN_NODES_IN_LEVEL;
        const position = {
          x: columnX + INITIAL_HORIZONTAL_POSITION.X,
          y: nodeY + INITIAL_HORIZONTAL_POSITION.Y,
        };

        // Update position in data store
        graphDataStore.updateNode(node.id, { position });
        // Update position in Cytoscape
        const cyNode = cy.getElementById(node.id);
        if (cyNode.length > 0) {
          cyNode.position(position);
        }
      });
    } else {
      // Vertical layout: levels are rows (y-axis), nodes stacked horizontally (x-axis)
      const rowY = levelNum * DISTANCE_BETWEEN_LEVELS + spacingAdjustment; // Add spacing adjustment

      // Stack nodes horizontally in each row
      nodesInLevel.forEach((node, index) => {
        // calculate nodeX from left to right
        const nodeX = index * DISTANCE_BETWEEN_NODES_IN_LEVEL;
        const position = {
          x: nodeX + INITIAL_VERTICAL_POSITION.X,
          y: rowY + INITIAL_VERTICAL_POSITION.Y,
        };

        // Update position in data store
        graphDataStore.updateNode(node.id, { position });
        // Update position in Cytoscape
        const cyNode = cy.getElementById(node.id);
        if (cyNode.length > 0) {
          cyNode.position(position);
        }
      });
    }
  });

  // Apply custom segment distances to edges
  applyCustomSegmentDistances(cy);

  // Update the dimensions to accommodate all elements
  updateCyOverviewDimensions(cy, LAYOUT_DIRECTION);

  // Show and render edge boxes (only for vertical layout in compact mode)
  const edgeBoxesContainer = document.getElementById('edge-boxes-container');
  if (edgeBoxesContainer) {
    edgeBoxesContainer.style.display = LAYOUT_DIRECTION === LAYOUT_DIRECTIONS.VERTICAL ? 'block' : 'none';
  }
  renderEdgeBoxes(
    graphDataStore,
    cy,
    LAYOUT_DIRECTION,
    LAYOUT_TYPE,
  );
}
