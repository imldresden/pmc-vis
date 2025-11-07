import { badges } from './badges.js';
import { COLORS, OUTLINES } from './variables.js';

const selections = {
  primary: {
    'border-color': COLORS.SELECTED_BORDER,
    'border-width': OUTLINES.width_selected,
    'border-style': 'double',
    'border-position': 'center',
    // opacity: 1,
  },
  secondary: {
    width: '10px',
    height: '10px',
    'border-color': COLORS.SECONDARY_SELECTION,
    'border-width': OUTLINES.width_selected,
    'border-style': 'solid',
    'border-position': 'center',
    // opacity: 1,
  },
};

const stylesheet = [
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
      label: 'data(id)',
      color: COLORS.LIGHT_TEXT,
      shape: 'rectangle',
      height: 20,
      width: 50,
      'font-size': 10,
      'font-family': 'monospace',
      'text-valign': 'center',
      'text-margin-y': '0.65px',
      'text-halign': 'center',
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
      'background-color': COLORS.SECONDARY_NODE_COLOR,
    },
  },
  {
    selector: 'node.s[[outdegree > 0]]', // expanded node
    style: {
      color: COLORS.DARK_TEXT,
      'background-opacity': 0,
      'border-color': COLORS.NODE_COLOR,
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
      'background-color': COLORS.RECURRING,
      'border-color': COLORS.RECURRING,
    },
  },
  {
    selector: 'edge',
    style: {
      label: 'data(label)',
      color: COLORS.NODE_COLOR,
      width: 1.5,
      'font-size': 8,
      'curve-style': 'bezier', // taxi
      'target-arrow-shape': 'triangle',
      'line-color': COLORS.EDGE_COLOR,
      'target-arrow-color': COLORS.EDGE_COLOR,
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
      'line-color': COLORS.HL_EDGE_COLOR,
      'target-arrow-color': COLORS.HL_EDGE_COLOR,
      'line-style': 'solid',
    },
  },
];

export {
  stylesheet, selections,
};
