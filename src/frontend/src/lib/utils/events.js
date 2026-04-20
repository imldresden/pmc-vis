const events = {

  GLOBAL_PROPAGATE: new CustomEvent('global-action', {
    detail: {
      action: 'propagate',
    },
  }),

  MATRIX_HOVER: (sourcePaneId, ids, edge = null) => new CustomEvent('matrix-hover', {
    detail: {
      sourcePaneId,
      ids,
      edge,
    },
  }),

  GLOBAL_MARK: (elements) => new CustomEvent('global-action', {
    detail: {
      action: 'mark',
      type: '',
      elements,
    },
  }),

  GLOBAL_UNMARK: (elements) => new CustomEvent('global-action', {
    detail: {
      action: 'mark',
      type: 'undo-',
      elements,
    },
  }),

  LINKED_SELECTION: (pane, selection) => new CustomEvent('linked-selection', {
    detail: {
      pane,
      selection,
    },
  }),

  MATRIX_SELECTION: (sourcePaneId, nodeId, isSelected) => new CustomEvent('matrix-selection', {
    detail: {
      sourcePaneId,
      nodeId,
      isSelected,
    },
  }),
};

export default events;
