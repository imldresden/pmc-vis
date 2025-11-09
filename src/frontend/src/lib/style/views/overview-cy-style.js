import { COLORS } from './variables.js';

const NODE_WIDTH = 8;
const NODE_HEIGHT = 8;

const BORDER_WIDTH = 2;
const BORDER_WIDTH_SELECTED = 4;

const overviewStylesheet = [
  {
    selector: 'core',
    style: {
      'selection-box-color': COLORS.SELECTED_NODE_COLOR,
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
      width: NODE_WIDTH - BORDER_WIDTH / 2 + (BORDER_WIDTH_SELECTED / 2 - BORDER_WIDTH / 2),
      height: NODE_HEIGHT - BORDER_WIDTH / 2 + (BORDER_WIDTH_SELECTED / 2 - BORDER_WIDTH / 2),
      'border-width': BORDER_WIDTH,
      'border-color': '#333',
      'border-opacity': 1,
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
    style: {
      'border-color': COLORS.SELECTED_BORDER,
      'border-width': BORDER_WIDTH_SELECTED,
      'border-style': 'double',
      'border-position': 'center',
      width: NODE_WIDTH - BORDER_WIDTH_SELECTED / 2,
      height: NODE_HEIGHT - BORDER_WIDTH_SELECTED / 2,
    },
  },
  {
    selector: 'edge',
    style: {
      label: '',
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
  {
    selector: 'edge.edge-highlighted',
    style: {
      width: 5,
      'z-index': 10,
    },
  },
  {
    selector: 'edge.edge-selected',
    style: {
      width: 5,
      'z-index': 10,
    },
  },
];

export {
  overviewStylesheet,
};
