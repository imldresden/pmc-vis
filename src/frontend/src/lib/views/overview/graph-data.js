/**
 * Graph Data Store
 * 
 * This module manages the graph data (nodes and edges) independently from Cytoscape.
 * Cytoscape is only used for rendering and selection, not as the source of truth.
 */

class GraphDataStore {
  constructor() {
    this.nodes = new Map(); // Map<nodeId, nodeData>
    this.edges = new Map(); // Map<edgeId, edgeData>
    this.listeners = new Set(); // Set of listeners for data changes
    this.selectedNodes = new Set(); // Set of selected node IDs
    this.selectionListeners = new Set(); // Set of listeners for selection changes
    this.edgeNotes = new Map(); // Map<edgeId, note>
    this.selectedEdgeId = null; // Currently selected edge ID
  }

  /**
   * Add a node to the store
   * @param {string} nodeId - Unique node identifier
   * @param {Object} nodeData - Node data (id, label, level, item, etc.)
   */
  addNode(nodeId, nodeData) {
    this.nodes.set(nodeId, { ...nodeData, id: nodeId });
    this.notifyListeners('nodeAdded', { nodeId, nodeData: this.nodes.get(nodeId) });
  }

  /**
   * Remove a node from the store
   * @param {string} nodeId - Node identifier to remove
   */
  removeNode(nodeId) {
    if (this.nodes.has(nodeId)) {
      this.nodes.delete(nodeId);
      // Remove all edges connected to this node
      const edgesToRemove = [];
      this.edges.forEach((edge, edgeId) => {
        if (edge.source === nodeId || edge.target === nodeId) {
          edgesToRemove.push(edgeId);
        }
      });
      edgesToRemove.forEach(edgeId => this.removeEdge(edgeId));
      this.notifyListeners('nodeRemoved', { nodeId });
    }
  }

  /**
   * Update a node in the store
   * @param {string} nodeId - Node identifier
   * @param {Object} updates - Partial node data to update
   */
  updateNode(nodeId, updates) {
    if (this.nodes.has(nodeId)) {
      const existing = this.nodes.get(nodeId);
      this.nodes.set(nodeId, { ...existing, ...updates });
      this.notifyListeners('nodeUpdated', { nodeId, nodeData: this.nodes.get(nodeId) });
    }
  }

  /**
   * Get a node by ID
   * @param {string} nodeId - Node identifier
   * @returns {Object|null} Node data or null if not found
   */
  getNode(nodeId) {
    return this.nodes.get(nodeId) || null;
  }

  /**
   * Get all nodes as an array
   * @returns {Array} Array of node data objects
   */
  getAllNodes() {
    return Array.from(this.nodes.values());
  }

  /**
   * Add an edge to the store
   * @param {string} edgeId - Unique edge identifier
   * @param {Object} edgeData - Edge data (id, source, target, label, classes, etc.)
   */
  addEdge(edgeId, edgeData) {
    this.edges.set(edgeId, { ...edgeData, id: edgeId });
    this.notifyListeners('edgeAdded', { edgeId, edgeData: this.edges.get(edgeId) });
  }

  /**
   * Remove an edge from the store
   * @param {string} edgeId - Edge identifier to remove
   */
  removeEdge(edgeId) {
    if (this.edges.has(edgeId)) {
      this.edges.delete(edgeId);
      this.edgeNotes.delete(edgeId);
      if (this.selectedEdgeId === edgeId) {
        this.selectedEdgeId = null;
      }
      this.notifyListeners('edgeRemoved', { edgeId });
    }
  }

  /**
   * Update an edge in the store
   * @param {string} edgeId - Edge identifier
   * @param {Object} updates - Partial edge data to update
   */
  updateEdge(edgeId, updates) {
    if (this.edges.has(edgeId)) {
      const existing = this.edges.get(edgeId);
      this.edges.set(edgeId, { ...existing, ...updates });
      this.notifyListeners('edgeUpdated', { edgeId, edgeData: this.edges.get(edgeId) });
    }
  }

  /**
   * Get an edge by ID
   * @param {string} edgeId - Edge identifier
   * @returns {Object|null} Edge data or null if not found
   */
  getEdge(edgeId) {
    return this.edges.get(edgeId) || null;
  }

  /**
   * Get all edges as an array
   * @returns {Array} Array of edge data objects
   */
  getAllEdges() {
    return Array.from(this.edges.values());
  }

  /**
   * Get edges connected to a node
   * @param {string} nodeId - Node identifier
   * @returns {Array} Array of edge data objects
   */
  getEdgesForNode(nodeId) {
    return this.getAllEdges().filter(edge => 
      edge.source === nodeId || edge.target === nodeId
    );
  }

  /**
   * Get edges where the node is the source
   * @param {string} nodeId - Node identifier
   * @returns {Array} Array of edge data objects
   */
  getOutgoingEdges(nodeId) {
    return this.getAllEdges().filter(edge => edge.source === nodeId);
  }

  /**
   * Get edges where the node is the target
   * @param {string} nodeId - Node identifier
   * @returns {Array} Array of edge data objects
   */
  getIncomingEdges(nodeId) {
    return this.getAllEdges().filter(edge => edge.target === nodeId);
  }

  /**
   * Clear all data
   */
  clear() {
    this.nodes.clear();
    this.edges.clear();
    this.edgeNotes.clear();
    this.selectedEdgeId = null;
    this.notifyListeners('cleared', {});
  }

  /**
   * Add a listener for data changes
   * @param {Function} listener - Callback function(event, data)
   */
  addListener(listener) {
    this.listeners.add(listener);
  }

  /**
   * Remove a listener
   * @param {Function} listener - Callback function to remove
   */
  removeListener(listener) {
    this.listeners.delete(listener);
  }

  /**
   * Notify all listeners of a change
   * @param {string} event - Event name (nodeAdded, nodeRemoved, etc.)
   * @param {Object} data - Event data
   */
  notifyListeners(event, data) {
    this.listeners.forEach(listener => {
      try {
        listener(event, data);
      } catch (error) {
        console.error('Error in graph data listener:', error);
      }
    });
  }

  /**
   * Get nodes filtered by a predicate function
   * @param {Function} predicate - Function(node) => boolean
   * @returns {Array} Array of matching node data objects
   */
  filterNodes(predicate) {
    return this.getAllNodes().filter(predicate);
  }

  /**
   * Get edges filtered by a predicate function
   * @param {Function} predicate - Function(edge) => boolean
   * @returns {Array} Array of matching edge data objects
   */
  filterEdges(predicate) {
    return this.getAllEdges().filter(predicate);
  }

  /**
   * Select a node
   * @param {string} nodeId - Node identifier to select
   * @param {boolean} additive - If true, add to selection; if false, clear previous selection
   */
  selectNode(nodeId, additive = false) {
    if (!additive) {
      this.clearSelection();
    }
    if (!this.selectedNodes.has(nodeId)) {
      this.selectedNodes.add(nodeId);
      this.notifySelectionListeners('nodeSelected', { nodeId });
    }
  }

  /**
   * Unselect a node
   * @param {string} nodeId - Node identifier to unselect
   */
  unselectNode(nodeId) {
    if (this.selectedNodes.has(nodeId)) {
      this.selectedNodes.delete(nodeId);
      this.notifySelectionListeners('nodeUnselected', { nodeId });
    }
  }

  /**
   * Toggle node selection
   * @param {string} nodeId - Node identifier to toggle
   * @param {boolean} additive - If true, add to selection; if false, clear previous selection
   */
  toggleNodeSelection(nodeId, additive = false) {
    if (this.isNodeSelected(nodeId)) {
      this.unselectNode(nodeId);
    } else {
      this.selectNode(nodeId, additive);
    }
  }

  /**
   * Clear all selected nodes
   */
  clearSelection() {
    const selectedIds = Array.from(this.selectedNodes);
    this.selectedNodes.clear();
    selectedIds.forEach(nodeId => {
      this.notifySelectionListeners('nodeUnselected', { nodeId });
    });
  }

  /**
   * Check if a node is selected
   * @param {string} nodeId - Node identifier
   * @returns {boolean} True if node is selected
   */
  isNodeSelected(nodeId) {
    return this.selectedNodes.has(nodeId);
  }

  /**
   * Get all selected node IDs
   * @returns {Array} Array of selected node IDs
   */
  getSelectedNodeIds() {
    return Array.from(this.selectedNodes);
  }

  /**
   * Add a listener for selection changes
   * @param {Function} listener - Callback function(event, data)
   */
  addSelectionListener(listener) {
    this.selectionListeners.add(listener);
  }

  /**
   * Remove a selection listener
   * @param {Function} listener - Callback function to remove
   */
  removeSelectionListener(listener) {
    this.selectionListeners.delete(listener);
  }

  /**
   * Notify all selection listeners of a change
   * @param {string} event - Event name (nodeSelected, nodeUnselected)
   * @param {Object} data - Event data
   */
  notifySelectionListeners(event, data) {
    this.selectionListeners.forEach(listener => {
      try {
        listener(event, data);
      } catch (error) {
        console.error('Error in graph data selection listener:', error);
      }
    });
  }

  /**
   * Get edge note
   * @param {string} edgeId - Edge identifier
   * @returns {string} Note text or empty string
   */
  getEdgeNote(edgeId) {
    return this.edgeNotes.get(edgeId) || '';
  }

  /**
   * Set edge note
   * @param {string} edgeId - Edge identifier
   * @param {string} note - Note text
   */
  setEdgeNote(edgeId, note) {
    this.edgeNotes.set(edgeId, note);
  }

  /**
   * Set edge notes for multiple edges
   * @param {Array<string>} edgeIds - Array of edge identifiers
   * @param {string} note - Note text to set for all edges
   */
  setEdgeNotes(edgeIds, note) {
    edgeIds.forEach(edgeId => {
      this.edgeNotes.set(edgeId, note);
    });
  }

  /**
   * Get selected edge ID
   * @returns {string|null} Selected edge ID or null
   */
  getSelectedEdgeId() {
    return this.selectedEdgeId;
  }

  /**
   * Set selected edge ID
   * @param {string|null} edgeId - Edge identifier to select, or null to clear
   */
  setSelectedEdgeId(edgeId) {
    this.selectedEdgeId = edgeId;
  }

  /**
   * Clear selected edge
   */
  clearSelectedEdge() {
    this.selectedEdgeId = null;
  }
}

// Create and export a singleton instance
export const graphDataStore = new GraphDataStore();

