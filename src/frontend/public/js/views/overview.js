import { overviewStylesheet } from "../../style/views/cy-style.js";
import { h, t } from "../utils/utils.js";
import { params } from "./node-link/layout-options/elk.js";

var isInitialized = false;

const $ = document.querySelector.bind(document);
const $overview_graph_config = $("#overview-graph-config");
window.addEventListener("load", (event) => {
  makeOverviewSettings();
});
const socket = io();
var cy2 = cytoscape({
  container: document.getElementById("cy-overview"),
  style: overviewStylesheet,
  layout: params,
  wheelSensitivity: 0.3,
});

cy2.ready(function () {
  // Add listeners
  bindListeners(cy2);
});

socket.on("pane data updated", (data) => {
  if (data) {
    // drawGraph(data);
  }
});

socket.on("handle pane added", (data) => {
  if (isInitialized && data) {
    onPaneAdded(data);
  }
  if (data.id === "pane-0" && !isInitialized) {
    isInitialized = true;
  }
});

socket.on("handle pane removed", (data) => {
  removeNode(data);
});

socket.on("handle active pane", (data) => {
  var nodes = cy2.nodes();

  nodes.forEach(function (node) {
    if (node.id() !== data) {
      node.removeClass("active-pane");
    } else {
      node.addClass("active-pane");
    }
  });
});

socket.on("disconnect", () => {
  location.reload();
});

socket.on("handle duplicate pane ids", (data) => {
  if (data && data.length > 0) {
    data.forEach((nodeId) => {
      cy2
        .style()
        .selector("#" + nodeId)
        .style({
          label: "*",
          "text-halign": "center",
          "text-valign": "center",
        })
        .update();
    });
  } else {
    cy2
      .style()
      .selector("node")
      .style({
        label: "",
      })
      .update();
  }
});

socket.on("handle reset pane-node markings", (data) => {
  cy2
    .style()
    .selector("node")
    .style({
      label: "",
    })
    .update();
});

function onPaneAdded(newPaneData) {
  const paneId = newPaneData.id;
  const spawnerNodes = newPaneData.spawnerNodes;

  const isDuplicate = paneId.includes("DUPLICATE");

  const elements = {
    nodes: [
      {
        data: {
          id: paneId,
          label: paneId,
        },
        style: {
          "background-color": newPaneData.backgroundColor,
          opacity: 0.3,
          shape: "rectangle",
          width: 20,
          height: 20,
        },
      },
    ],
    edges: newPaneData.spawner
      ? Array.isArray(newPaneData.spawner)
        ? newPaneData.spawner.map((spawner, i) => {
            return {
              data: {
                id: newPaneData.spawner[i] + paneId,
                source: newPaneData.spawner[i],
                target: paneId,
                label: "merged",
              },
            };
          })
        : [
            {
              data: {
                id: spawnerNodes?.join(", ") + paneId,
                source: newPaneData.spawner,
                target: paneId,
                label: isDuplicate
                  ? "DUPL-" + spawnerNodes?.join(", ")
                  : spawnerNodes?.join(", "),
              },
            },
          ]
      : [],
  };

  cy2.add(elements);
  cy2.nodes().forEach((node) => {
    const backgroundColor = node.style("background-color");
    // set node color one more time, because of a bug (node color won't set after several expansions)
    node.style("background-color", backgroundColor);
  });
  cy2.layout(params).run();
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
  cy2.remove("#" + nodeIdToRemove);
}

function bindListeners(cy2) {
  cy2.on("click", "node", function (event) {
    var node = event.target;

    socket.emit("overview node clicked", node.id());
  });

  cy2.on("select", function (event) {
    var selectedNodes = cy2.$("node:selected");

    var selectedNodeIDs = selectedNodes.map((node) => node.id());
    socket.emit("overview nodes selected", selectedNodeIDs);
  });
}

function makeOverviewSettings() {
  const $buttons = h("div", { class: "buttons param" }, []);
  const $buttons2 = h("div", { class: "buttons param" }, []);
  const $buttons3 = h("div", { class: "buttons param" }, []);
  const $buttonMerge = h("button", { class: "ui button", id: "child-button" }, [
    h("span", {}, [t("Merge")]),
  ]);
  const $buttonRemove = h(
    "button",
    { class: "ui button", id: "child-button" },
    [h("span", {}, [t("Remove")])]
  );
  const $buttonDuplicate = h(
    "button",
    { class: "ui button", id: "child-button" },
    [h("span", {}, [t("Duplicate")])]
  );
  const $buttonExport = h(
    "button",
    { class: "ui button", id: "child-button" },
    [h("span", {}, [t("Export")])]
  );
  const $buttonExpand = h(
    "button",
    { class: "ui button", id: "child-button" },
    [h("span", {}, [t("Expand")])]
  );
  const $buttonCollapse = h(
    "button",
    { class: "ui button", id: "child-button" },
    [h("span", {}, [t("Collapse")])]
  );

  $buttonMerge.addEventListener("click", async function () {
    socket.emit("handle selection", "merge");
  });
  $buttonRemove.addEventListener("click", async function () {
    socket.emit("handle selection", "delete");
  });
  $buttonDuplicate.addEventListener("click", async function () {
    socket.emit("handle selection", "duplicate");
  });
  $buttonExport.addEventListener("click", async function () {
    socket.emit("handle selection", "export");
  });
  $buttonExpand.addEventListener("click", async function () {
    socket.emit("handle selection", "expand");
  });
  $buttonCollapse.addEventListener("click", async function () {
    socket.emit("handle selection", "collapse");
  });
  $buttons.appendChild($buttonMerge);
  $buttons.appendChild($buttonRemove);
  $buttons2.appendChild($buttonDuplicate);
  $buttons2.appendChild($buttonExport);
  $buttons3.appendChild($buttonExpand);
  $buttons3.appendChild($buttonCollapse);

  $overview_graph_config?.appendChild($buttons3);
  $overview_graph_config?.appendChild($buttons);
  $overview_graph_config?.appendChild($buttons2);
}
