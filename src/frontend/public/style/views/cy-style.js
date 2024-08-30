const LIGHT = true;

const colors = {
  NODE_COLOR: "#555",
  DARK_TEXT: "#555",
  LIGHT_TEXT: "#fff",

  SELECTED_BORDER: "#4887b9",

  SECONDARY_NODE_COLOR: "#afafaf",
  CENTRAL_NODE_COLOR: "#E5C07B",
  SELECTED_NODE_COLOR: "#4887b9",
  SECONDARY_SELECTION: "#ee8c31",
  DUAL_SELECTION: "#a4c35d",

  EDGE_COLOR: "#dadada",
  HL_EDGE_COLOR: "#b8b8b8",
  EDGE_LABEL_COLOR: "#b3b3b3",
};

const outlines = {
  width_selected: 10,
  width: 2,
};

const selections = {
  primary: {
    "border-color": colors.SELECTED_BORDER,
    "border-width": outlines.width_selected,
    "border-style": "double",
    opacity: 1,
  },
  secondary: {
    "border-color": colors.SECONDARY_SELECTION,
    "border-width": outlines.width_selected,
    "border-style": "double",
    width: "10px",
    height: "10px",
    opacity: 1,
  },
};

const badges = {
  dim: "10px",
  x: "113%",
  y: "-50%",
};

const stylesheet = [
  {
    selector: "core",
    style: {
      "selection-box-color": colors.SELECTED_NODE_COLOR,
      "selection-box-border-color": "#8BB0D0",
      "selection-box-opacity": "0.5",
    },
  },
  {
    selector: "node.s",
    style: {
      //"label": "data(id)",
      "font-size": 10,
      "text-valign": "center",
      "text-halign": "center",
      "background-color": colors.NODE_COLOR,
      "text-outline-color": colors.NODE_COLOR,
      "text-outline-width": "2px",
      color: colors.LIGHT_TEXT,
      "overlay-padding": "6px",
      "z-index": "10",
      shape: "rectangle",
      height: 20,
      width: 50,

      "background-opacity": 1,
      "border-width": outlines.width,
      "border-color": colors.NODE_COLOR,
      "text-outline-opacity": 0,
    },
  },
  {
    selector: "node.s.marked",
    style: {
      "background-image": "/style/icons/badge-green.svg",
      "background-image-containment": "over",
      "bounds-expansion": "20px",
      "background-clip": "none",
      "background-height": badges.dim,
      "background-width": badges.dim,
      "background-position-x": badges.x,
      "background-position-y": badges.y,
    },
  },
  {
    selector: "node.t",
    style: {
      height: "5px",
      width: "5px",
      shape: "ellipse",
      "background-color": colors.SECONDARY_NODE_COLOR,
    },
  },
  {
    selector: "node.s:selected",
    style: selections.primary,
  },
  {
    selector: "node.t:selected",
    style: selections.secondary,
  },
  {
    selector: "node.visited",
    style: {
      // "background-opacity": 0.3,
      color: colors.DARK_TEXT,
      "border-color": "#439843",
    },
  },
  {
    selector: "node.centralNode",
    style: {
      // "background-opacity": 0.3,
      color: colors.DARK_TEXT,
      "border-color": "#439843",
    },
  },
  {
    selector: "edge",
    style: {
      label: "data(label)",
      "font-size": 8,
      color: colors.NODE_COLOR,
      "curve-style": "bezier", //taxi
      width: 1.5,
      //'arrow-scale': 0.8
      "target-arrow-shape": "triangle",
      //'text-outline-color' : colors.NODE_COLOR,
      //'text-outline-opacity' : 1,
      //'text-outline-width' : 0.8,

      "line-color": colors.EDGE_COLOR,
      "target-arrow-color": colors.EDGE_COLOR,
      "line-style": "dashed",
      "line-dash-pattern": [6, 3],
      "line-dash-offset": 24,
    },
  },
  {
    selector: "edge.scheduler",
    style: {
      "line-color": colors.HL_EDGE_COLOR,
      "target-arrow-color": colors.HL_EDGE_COLOR,
      "line-style": "solid",
    },
  },
];

const overviewStylesheet = [
  {
    selector: "core",
    style: {
      "selection-box-color": colors.SELECTED_NODE_COLOR,
      "selection-box-border-color": "#8BB0D0",
      "selection-box-opacity": "0.5",
    },
  },
  {
    selector: "node.active-pane",
    style: {
      "border-color": "#439843",
      "border-width": "1px",
      "border-style": "solid",
    },
  },
  {
    selector: "node:selected",
    style: selections.primary,
  },
  {
    selector: "edge",
    style: {
      label: "data(label)",
      "font-size": 8,
      color: colors.NODE_COLOR,
      "curve-style": "bezier", //taxi
      width: 1.5,
      //'arrow-scale': 0.8
      "target-arrow-shape": "triangle",
      //'text-outline-color' : colors.NODE_COLOR,
      //'text-outline-opacity' : 1,
      //'text-outline-width' : 0.8,

      "line-color": colors.EDGE_COLOR,
      "target-arrow-color": colors.EDGE_COLOR,
      "line-style": "dashed",
      "line-dash-pattern": [6, 3],
      "line-dash-offset": 24,
    },
  },
];

export { stylesheet, colors, selections, overviewStylesheet };
