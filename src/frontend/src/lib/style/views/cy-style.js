import { badges } from './badges.js';

const colors = {
  NODE_COLOR: '#555',
  DARK_TEXT: '#555',
  LIGHT_TEXT: '#fff',

  SELECTED_BORDER: '#4887b9',

  RECURRING: '#4da3ff',
  SECONDARY_NODE_COLOR: '#afafaf',
  CENTRAL_NODE_COLOR: '#E5C07B',
  SELECTED_NODE_COLOR: '#4887b9',
  SECONDARY_SELECTION: '#ee8c31',
  DUAL_SELECTION: '#a4c35d',

  EDGE_COLOR: '#dadada',
  HL_EDGE_COLOR: '#d6730f',
  EDGE_LABEL_COLOR: '#b3b3b3',
};

const outlines = {
  width_selected: 10,
  width: 2,
};

const selections = {
  primary: {
    'border-color': colors.SELECTED_BORDER,
    'border-width': outlines.width_selected,
    'border-style': 'double',
    'border-position': 'center',
    // opacity: 1,
  },
  secondary: {
    width: '10px',
    height: '10px',
    'border-color': colors.SECONDARY_SELECTION,
    'border-width': outlines.width_selected,
    'border-style': 'solid',
    'border-position': 'center',
    // opacity: 1,
  },
};

const stylesheet = [
  {
    selector: 'core',
    style: {
      'selection-box-color': colors.SELECTED_NODE_COLOR,
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
      label: 'data(id)',
      color: colors.LIGHT_TEXT,
      shape: 'rectangle',
      height: 20,
      width: 50,
      'font-size': 10,
      'font-family': 'monospace',
      'text-valign': 'center',
      'text-margin-y': '0.65px',
      'text-halign': 'center',
      'background-color': colors.NODE_COLOR,
      'text-outline-color': colors.NODE_COLOR,
      'text-outline-width': '2px',
      'overlay-padding': '6px',
      'z-index': '10',
      'background-opacity': 1,
      'border-width': outlines.width,
      'border-color': colors.NODE_COLOR,
      'text-outline-opacity': 0,
    },
  },
  {
    selector: 'node.s.marked',
    style: {
      'background-image': '/src/lib/style/icons/badge-green.svg',
      'background-image-containment': 'over',
      'background-clip': 'none',
      'bounds-expansion': '11',
      'background-height': badges.height,
      'background-width': badges.width,
      'background-position-x': badges.x,
      'background-position-y': badges.y,
    },
  },
  {
    selector: 'node.s.marked:selected',
    style: {
      'bounds-expansion': '12',
      'background-position-y': badges.y_s,
    },
  },
  {
    selector: 'node.t',
    style: {
      height: '5px',
      width: '5px',
      shape: 'ellipse',
      'background-color': colors.SECONDARY_NODE_COLOR,
    },
  },
  {
    selector: 'node.s[[outdegree > 0]]', // expanded node
    style: {
      color: colors.DARK_TEXT,
      'background-opacity': 0,
      'border-color': colors.NODE_COLOR,
    },
  },
  {
    selector: 'node.s:selected',
    style: selections.primary,
  },
  {
    selector: 'node.t:selected',
    style: selections.secondary,
  },
  {
    selector: 'node.recurring',
    style: {
      'background-opacity': 1,
      'background-color': colors.RECURRING,
      'border-color': colors.RECURRING,
    },
  },
  {
    selector: 'edge',
    style: {
      label: 'data(label)',
      color: colors.NODE_COLOR,
      width: 1.5,
      'font-size': 8,
      'curve-style': 'bezier', // taxi
      'target-arrow-shape': 'triangle',
      'line-color': colors.EDGE_COLOR,
      'target-arrow-color': colors.EDGE_COLOR,
      'line-style': 'dashed',
      'line-dash-pattern': [6, 3],
      'line-dash-offset': 24,
      'text-outline-color': 'white',
      'text-outline-opacity': 1,
      'text-outline-width': '1px',
    },
  },
  {
    selector: 'edge.scheduler',
    style: {
      'line-color': colors.HL_EDGE_COLOR,
      'target-arrow-color': colors.HL_EDGE_COLOR,
      'line-style': 'solid',
    },
  },
];

const overviewStylesheet = [
  {
    selector: 'core',
    style: {
      'selection-box-color': colors.SELECTED_NODE_COLOR,
      'selection-box-border-color': '#8BB0D0',
      'selection-box-opacity': '0.5',
    },
  },
  {
    selector: 'node',
    style: {
      'background-color': '#95a5a6',
      'background-opacity': 0.8,
      'text-valign': 'center',
      'text-halign': 'center',
      color: 'white',
      'font-size': '10px',
      'font-weight': 'bold',
      width: 4,
      height: 4,
      'border-width': 2,
      'border-color': '#333',
      'border-opacity': 0.8,
    },
  },
  {
    selector: 'node.active-pane',
    style: {
      'border-color': '#439843',
      'border-width': '3px',
      'border-style': 'solid',
    },
  },
  {
    selector: 'node:selected',
    style: selections.primary,
  },
  {
    selector: 'edge',
    style: {
      label: 'data(label)',
      width: 3,
      'line-color': '#34495e',
      'target-arrow-color': '#34495e',
      'target-arrow-shape': 'triangle',
      'curve-style': 'round-segments',
      'segment-distances': [0, 100],
      'segment-weights': [0.5, 0.5],
      'font-size': 16,
      color: '#34495e',
      'text-outline-color': 'white',
      'text-outline-opacity': 1,
      'text-outline-width': '1px',
    },
  },
  {
    selector: 'edge.merge-edge',
    style: {
      'line-style': 'dashed',
      'line-dash-pattern': [4, 2],
      'line-color': '#e67e22',
      'target-arrow-color': '#e67e22',
      width: 3,
    },
  },
  {
    selector: 'edge.duplicate-edge',
    style: {
      'line-style': 'dotted',
      'line-dash-pattern': [3, 3],
      'line-color': '#8e44ad',
      'target-arrow-color': '#8e44ad',
      width: 2,
    },
  },
  {
    selector: 'node[isDuplicate="true"]',
    style: {
      'border-color': '#8e44ad',
      'border-width': 3,
      'border-opacity': 1,
    },
  },
  {
    selector: 'node.selected',
    style: {
      'border-width': 4,
      'border-color': '#e67e22',
      'border-opacity': 1,
    },
  },
];

export {
  stylesheet, colors, selections, overviewStylesheet,
};
