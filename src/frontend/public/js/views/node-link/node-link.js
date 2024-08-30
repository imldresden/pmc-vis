import { colors, selections, stylesheet } from '../../../style/views/cy-style.js';
import { calcPaneDims, getPanes, spawnPane, togglePane, info, destroyPanes } from '../panes.js';
import { h, t, fixed } from '../../utils/utils.js';
import { makeTippy, hideAllTippies, setPane, PROJECT } from '../../utils/controls.js';
import { parallelCoords } from '../parallel-coords/parallel-coords.js';
import { ndl_to_pcp } from '../format.js';
import NAMES from '../../utils/names.js';

function getEdgeId(edge) {
  return edge.data.source + edge.data.label + edge.data.target;
}

// used to avoid duplication and wrong removal of nodes and edges
function setElementMapper(cy, elements) {
  cy.elementMapper = {
    nodes: new Map(),
    edges: new Map(),
  }
  elements.nodes.forEach((node) => {
    node.data.id
    cy.elementMapper.nodes.set(node.data.id, node);
  });
  elements.edges.forEach((edge) => {
    cy.elementMapper.edges.set(getEdgeId(edge), edge);
  });
}

// applies data dependent styling to nodes
function setStyles(cy) {
  cy.startBatch();
  cy.nodes().addClass('t').filter(n => {
    return n.data().type === 's';
  }).removeClass('t').addClass('s');

  cy.edges().removeClass('scheduler').filter(n => {
    const source = n.data().source;
    const target = n.data().target;
    //console.log(n.data())

    if (source && source.startsWith('t_')) {
      const node = cy.elementMapper.nodes.get(source);
      if (node && node.data.scheduler) {
        return node.data.scheduler[cy.vars['scheduler'].value] > 0;
      }

      return false;
    }

    if (target && target.startsWith('t_')) {
      const node = cy.elementMapper.nodes.get(target);
      //console.log(node)
      if (node && node.data.scheduler) {
        return node.data.scheduler[cy.vars['scheduler'].value] > 0;
      }

      return false;
    }
  }).addClass('scheduler');
  cy.endBatch();
  //console.log(cy.$('edge.scheduler'))
}

// requests outgoing edges from a selection of nodes and adds them to the graph
function graphExtend(cy, node) {
  node.addClass('visited');
  const g = node.data();

  Promise.all([
    fetch('http://localhost:8080/' + PROJECT + '/outgoing?id=' + g.id).then((res) => res.json())
  ]).then((promises) => {
    const data = promises[0];

    const elements = {
      nodes: data.nodes.map(d => {
        return {
          group: 'nodes',
          data: d,
          //position: node.position() // WARNING: setting this prop makes nodes immutable, possible bug with cytoscape
        };
      })
        .filter(d => {
          const accept = !cy.elementMapper.nodes.has(d.data.id);
          if (accept) {
            cy.elementMapper.nodes.set(d.data.id, d);
          }
          return accept;
        }),
      edges: data.edges.map(d => {
        return {
          group: 'edges',
          data: { id: d.id, label: d.label, source: d.source, target: d.target },
        };
      })
        .filter(d => {
          const accept = !cy.elementMapper.edges.has(getEdgeId(d));
          if (accept) {
            cy.elementMapper.edges.set(getEdgeId(d), d);
          }
          return accept;
        })
    }

    cy.nodes().lock()
    cy.add(elements);
    cy.$('#' + elements.nodes.map(n => n.data.id).join(', #')).position(node.position()); // alternatively, cy.nodes().position(node.position())
    cy.nodes().unlock();

    cy.layout(cy.params).run();
    bindListeners(cy);
    setStyles(cy);
    initHTML(cy);
  });
}

// inits cy with graph data on a pane
function spawnGraph(pane, data, params, vars = {}, src) {
  const elements = {
    nodes: data.nodes.map(d => { return { data: d.data ? d.data : d } }),
    edges: data.edges.map(d => { return { data: d.data ? d.data : d } })
  }

  const cytoscapeInit = {
    container: document.getElementById(pane.container),
    style: stylesheet,
    layout: params,
    wheelSensitivity: 0.3
  };

  const cy = pane.cy = window.cy = cytoscape(cytoscapeInit);

  if (data.cyImport) {
    cy.json(data.cyImport);
  } else {
    cy.add(elements);
  }

  setElementMapper(cy, {
    nodes: cy.elements().nodes().map(d => { return { data: d.data() } }),
    edges: cy.elements().edges().map(d => { return { data: d.data() } }),
  });

  cy.startBatch();
  if (src) {
    cy.$('#' + src.map(n => n.id).join(', #')).addClass('centralNode');
  }

  // init props used from elsewhere
  cy.params = params;
  cy.paneId = pane.id;
  cy.stylesheet = stylesheet;
  setPublicVars(cy, vars);
  setStyles(cy);
  bindListeners(cy);
  setPane(pane.id, true);
  cy.endBatch();

  initHTML(cy);
  spawnPCP(cy, cy.nodes().map(n => n.data()));
  dispatchEvent(new CustomEvent("global-action", {
    detail: {
      action: 'propagate',
    },
  }));
  return cy;
}

function initHTML(cy) {
  const nodesHTML = document.getElementsByClassName(`cy-html cy-html-${cy.paneId}`);

  // the html layer lives here, remove it before creating a new one
  if (nodesHTML[0] && nodesHTML[0].parentNode && nodesHTML[0].parentNode.parentNode) {
    nodesHTML[0].parentNode.parentNode.remove()
  }

  cy.nodeHtmlLabel([
    {
      query: '.s',
      tpl: function (data) {
        const icons = Object
          .values(data.details[NAMES.atomicPropositions])
          .filter(ap => ap.value)
          .map(ap => ap.icon ? `<i class="${ap.identifier}"></i>` : `<p>${ap.identifier}</p>`)

        const template =
          `<div class="cy-html cy-html-${cy.paneId}" id="${data.id + "-" + cy.paneId}">
            ${icons.join('&nbsp;')}
          </div>`;

        return template;
      }
    },
    {
      query: '.s.visited, .centralNode',
      tpl: function (data) {
        const icons = Object
          .values(data.details[NAMES.atomicPropositions])
          .filter(ap => ap.value)
          .map(ap => ap.icon ? `<i class="${ap.identifier} inverted-text"></i>` : `<p class="inverted-text">${ap.identifier}</p>`)

        const template =
          `<div class="cy-html cy-html-${cy.paneId}" id="${data.id + "-" + cy.paneId}">
            ${icons.join('&nbsp;')}
          </div>`;

        return template;
      }
    }
  ]);
}

// creates new pane and then spawns graph 
function spawnGraphOnNewPane(cy, nodes) {
  if (nodes.length === 0) {
    return; // console.error? 
  }

  Promise.all([
    fetch('http://localhost:8080/' + PROJECT + '/outgoing?id=' + nodes.map(n => n.id).join('&id=')).then((res) => res.json())
  ]).then((promises) => {
    const data = promises[0];

    const pane = spawnPane(
      calcPaneDims(data.nodes.length),
      { spawner: cy.container().parentElement.id }, // pane that spawns the new one 
    );

    let vars = {}
    if (cy.vars) {
      const varsValues = {};
      Object.keys(cy.vars).forEach(k => {
        if (cy.vars[k].avoidInClone) {
          return;
        }
        varsValues[k] = {
          value: cy.vars[k].value,
        }
      });
      vars = structuredClone(varsValues);
    }
    spawnGraph(pane, data, structuredClone(cy.params), vars, nodes);

  });
}

// interactions
function ctxmenu(cy) {
  cy.ctxmenu = cy.contextMenus({
    menuItems: [
      // node specific
      {
        id: 'expand',
        content: 'Expand outgoing',
        tooltipText: 'expand outgoing',
        selector: 'node.s',
        onClickFunction: function (event) {
          const target = event.target || event.cyTarget;
          setPane(cy.paneId);
          hideAllTippies();
          graphExtend(cy, target);
        },
        hasTrailingDivider: false
      },
      /*{
        id: 'remove',
        content: 'Collapse outgoing',
        tooltipText: 'collapse outgoing',
        selector: 'node.s',
        onClickFunction: function (event) {
          const target = event.target || event.cyTarget;
          console.log('Under development!')
        },
        hasTrailingDivider: false
      },*/  
      {
        id: 'color',
        content: 'Mark/unmark node',
        tooltipText: 'mark node',
        selector: 'node.s',
        onClickFunction: function (event) {
          const target = event.target || event.cyTarget;

          if (!target.classes().includes('marked')) {
            dispatchEvent(new CustomEvent("global-action", {
              detail: {
                action: 'mark',
                type: '',
                elements: [target.data().id],
              },
            }));
          } else {
            dispatchEvent(new CustomEvent("global-action", {
              detail: {
                action: 'mark',
                type: 'undo-',
                elements: [target.data().id],
              },
            }));
          }
        },
        hasTrailingDivider: true,
      },
      {
        id: 'commit',
        content: 'Explore in new pane',
        tooltipText: 'explore in new pane',
        selector: 'node.s:selected',
        onClickFunction: function (event) {
          //const target = event.target || event.cyTarget; // gives the selected node
          const nodes = cy.$('node.s:selected');
          //setPane(cy.paneId);
          hideAllTippies();
          spawnGraphOnNewPane(cy, nodes.map(n => n.data()));
        },
        hasTrailingDivider: false,
      },
      {
        id: 'inspect-pcp',
        content: 'Inspect selection details',
        tooltipText: 'inspect selection details',
        selector: 'node:selected',
        onClickFunction: function (event) {
          spawnPCP(cy);
        },
        hasTrailingDivider: true
      },

      // pane controls
      {
        id: 'fit-to-pane',
        content: 'Fit to view',
        tooltipText: 'fit to pane',
        coreAsWell: true,
        onClickFunction: () => cy.fit(),
        hasTrailingDivider: false
      },
      {
        id: 'collapse-pane',
        content: 'Collapse/expand pane',
        tooltipText: 'collapse/expand pane',
        coreAsWell: true,
        onClickFunction: () => {
          togglePane(document.getElementById(document.getElementById('selected-pane').innerHTML))
        },
        hasTrailingDivider: true
      },
      {
        id: 'import-pane',
        content: 'Import Graph',
        tooltipText: 'import graph',
        selector: 'node, edge',
        coreAsWell: true,
        onClickFunction: () => {
          importCy(cy);
        },
        hasTrailingDivider: false
      },
      {
        id: 'export-pane',
        content: 'Export Graph',
        tooltipText: 'export graph',
        selector: 'node, edge',
        coreAsWell: true,
        onClickFunction: () => {
          exportCy(cy);
        },
        hasTrailingDivider: true
      },
      {
        id: 'duplicate-pane',
        content: 'Duplicate pane',
        tooltipText: 'dup-pane',
        coreAsWell: true,
        onClickFunction: () => {
          const data = {
            nodes: Array.from(cy.elementMapper.nodes.values()),
            edges: Array.from(cy.elementMapper.edges.values()),
            info: info,
            cyImport: cy.json()
          };

          const pane = spawnPane(
            calcPaneDims(data.nodes.length),
            {
              spawner: cy.container().parentElement.id,
              id: 'DUPLICATE-' + cy.paneId
            },
          );

          let vars = {}
          if (cy.vars) {
            const varsValues = {};
            Object.keys(cy.vars).forEach(k => {
              if (cy.vars[k].avoidInClone) {
                return;
              }
              varsValues[k] = {
                value: cy.vars[k].value,
              }
            });
            vars = structuredClone(varsValues);
          }

          spawnGraph(pane, data, structuredClone(cy.params), vars);
        },
        hasTrailingDivider: false
      },
      {
        id: 'destroy-pane',
        content: 'Remove pane',
        tooltipText: 'remove pane',
        coreAsWell: true,
        onClickFunction: () => {
          if (cy.paneId === 'pane-0') {
            Swal.fire({
              icon: 'error',
              title: 'Oops...',
              text: 'Cannot delete initial pane!'
            })
          } else {
            Swal.fire({
              title: 'Removing Pane(s)',
              text: 'This action cannot be reverted.',
              icon: 'warning',
              showCancelButton: true,
              showDenyButton: true,
              confirmButtonColor: '#d33',
              cancelButtonColor: '#555',
              confirmButtonText: 'Remove Current',
              denyButtonText: 'Remove All From Selected',
            }).then((result) => {
              if (result.isConfirmed) {
                destroyPanes(getPanes()[cy.paneId].id, true);
              } else if (result.isDenied) {
                destroyPanes(getPanes()[cy.paneId].id);
              }
            })

          }
        },
        hasTrailingDivider: true
      },
    ],
    menuItemClasses: ['dropdown-item'],
    contextMenuClasses: ['dropdown-menu'],
    submenuIndicator: { src: '/style/icons/submenu.svg', width: 12, height: 12 }
  });
}

function lockCy(cy) {
  cy.nodes().lock();
  cy.panningEnabled(false);
  cy.zoomingEnabled(false);
  unbindListeners(cy);

  cy.on('tap', function (e) {
    setPane(cy.paneId);
  });

  cy.on('grabon', function (e) {
    setPane(cy.paneId);
  });

  cy.on('cxttapstart', function (e) {
    setPane(cy.paneId);
    console.log('right click lane')
  });
}

function unlockCy(cy) {
  cy.nodes().unlock();
  cy.panningEnabled(true);
  cy.zoomingEnabled(true);
  bindListeners(cy);
}

function spawnPCP(cy, _nodes) {

  const nodes = _nodes || cy.$('node:selected').map(n => n.data());
  let pcp_data = ndl_to_pcp({
    nodes: nodes.filter(d => cy.vars['mode'].value.includes(d.type))
  }, cy.vars['details'].value);

  if (!pcp_data.length > 0) {
    console.warn('tried to spawn PCP without any selection, using full nodeset');
    pcp_data = ndl_to_pcp({
      nodes:
        cy.$('node')
          .map(n => n.data())
          .filter(d => cy.vars['mode'].value.includes(d.type))
    }, cy.vars['details'].value);
  }

  //lockCy(cy);
  //cy.container().childNodes.forEach(c => c.style.visibility = 'hidden');

  const hidden = new Set(['color']);
  const props = Object.keys(pcp_data[0]).filter(k => !hidden.has(k));

  cy.pcp = parallelCoords(
    getPanes()[cy.paneId],
    pcp_data,
    {
      data_id: 'id',
      nominals: props.filter(k => pcp_data[0][k].type === 'nominal'),
      booleans: props.filter(k => pcp_data[0][k].type === 'boolean'),
      ordinals: props.filter(k => pcp_data[0][k].type === 'ordinals'),
      cols: props
    }
  );

  //unlockCy(cy);

  cy.paneFromPCP = (pane) => {
    spawnGraphOnNewPane(pane.cy, pane.cy.pcp.getSelection());
  }
}

function unbindListeners(cy) {
  // clean listeners
  cy.off('tap');
  cy.off('cxttapstart');
  cy.off('grabon');
  cy.off('tap', 'edge');
  cy.off('zoom pan');
  cy.nodes().forEach(function (n) {
    n.off('click');
    n.off('dblclick');
  });
  if (cy.ctxmenu) {
    cy.ctxmenu.destroy();
  }

}

function bindListeners(cy) {
  unbindListeners(cy);

  // new listeners
  cy.on('tap', function (e) {
    if (e.target === cy) {
      setPane(cy.paneId);
      hideAllTippies();
    }
  })

  cy.on('cxttapstart', function (e) {
    setPane(cy.paneId);
    hideAllTippies();
  });

  ctxmenu(cy);

  cy.on('grabon', function (e) {
    setPane(cy.paneId);
    if (!e.originalEvent.shiftKey) {
      hideAllTippies();
    }
  })

  cy.on('tap', 'edge', function (e) {
    setPane(cy.paneId);
    hideAllTippies();
  });

  cy.on('zoom pan', function (e) {
    setPane(cy.paneId);
    hideAllTippies();
  });

  cy.nodes().forEach(function (n) {
    n.on('click', function (e) {
      setPane(cy.paneId);

      if (!e.originalEvent.shiftKey) {
        hideAllTippies();
      }

      if (e.originalEvent.shiftKey) {
        let g = n.data();

        const $links = [];

        const details = cy.vars['details'].value;
        Object.keys(details).forEach(d => {
          const show = details[d].all || Object.values(details[d].props).reduce((a, b) => a || b);

          if (show) {
            $links.push(
              h('p', {}, [t(`==== ${d} ====`)]),
              ...Object.keys(details[d].props)
                .filter(p => details[d].props[p])
                .map(k => {
                  const detail = g.details[d][k];
                  if (detail.type === 'ordinal') {
                    return h('p', {}, [t(k + ': ' + fixed(detail.value) + '\n ')]);
                  } else {
                    return h('p', {}, [t(k + ': ' + (detail.value) + '\n ')]);
                  }
                })
            )
          }
        });

        makeTippy(n, h('div', {}, $links), `tippy-${g.id}`);
      }

      if (e.originalEvent.altKey && n.classes().filter(c => c === 's').length > 0) {
        graphExtend(cy, n);
      }
    });

    n.on('dblclick', function (e) {
      //setPane(cy.paneId);
      hideAllTippies();
      spawnGraphOnNewPane(cy, [n.data()]);
    });
  });
}

// functions called from other to set variables (see setPublicVars below)
function setSelectMode(cy, mode = 's') {
  cy.vars['mode'].value = mode;

  cy.startBatch();
  //adjust selection styles
  if (mode === 's') { //states
    cy.style().selector('core').css({ "selection-box-color": colors.SELECTED_NODE_COLOR });

    cy.style().selector('node.t:selected').css({
      'opacity': '0.5',
      'border-color': colors.SECONDARY_NODE_COLOR,
    })

    cy.style().selector('node.s:selected').css(selections.primary);

  } else if (mode === 't') { //actions / transitions
    cy.style().selector('core').css({ "selection-box-color": colors.SECONDARY_SELECTION });

    cy.style().selector('node.s:selected').css({
      'opacity': '0.5',
      'border-color': colors.NODE_COLOR,
    });

    cy.style().selector('node.t:selected').css(selections.secondary);

  } else if (mode === 's+t') { //both
    cy.style().selector('core').css({ "selection-box-color": colors.DUAL_SELECTION });

    cy.style().selector('node.s:selected').css(selections.primary);
    cy.style().selector('node.t:selected').css(selections.secondary);
  }

  cy.style().update();
  cy.endBatch();
}

function updateDetailsToShow(cy, { update, mode = NAMES.results }) {
  const props = {};
  const details = cy.elements()[0].data().details;

  let init = true;
  if (update) {
    init = false;
  }

  Object.keys(details).forEach(d => {
    let truthVal = false;
    if (d === mode) {
      truthVal = true;
    }

    props[d] = { all: init ? truthVal : update[d].all, props: {}, metadata: {} };
    Object.keys(details[d]).forEach(p => {
      props[d].props[p] = init ? truthVal : update[d].props[p];
      props[d].metadata[p] = info[d] ? info[d][p] : undefined;
    });
  });

  cy.vars['details'].value = props;
  spawnPCP(cy);
}

function updateScheduler(cy, prop) {
  cy.vars['scheduler'].value = prop;

  setStyles(cy);

  cy.resize();
}

function cyUndoRedo(cy, e) {
  if (e.keyCode == 90 && e.ctrlKey) {
    cy.vars['ur'].value.undo(); // ctrl+z
  } else if (e.keyCode == 89 && e.ctrlKey) {
    cy.vars['ur'].value.redo(); // ctrl+y
  }
}

function mark(cy, selection) {
  const node = cy.$('#' + selection.join(', #'))
  node.addClass('marked');
}

function unmark(cy, selection) {
  const node = cy.$('#' + selection.join(', #'))
  node.removeClass('marked');
}

async function importCy(cy) {
  await Swal.fire({
    title: 'Import Model to Pane',
    html: `
        <p> Select .json file to import to the Graph View </p>
        <label style="float:left;margin-bottom:10px" for="prism-model">Choose a model file:</label>
        <div class="ui file input">
            <input id="import-graph" type="file" accept=".json">
        </div>
        `,
    focusConfirm: false,
    confirmButtonText: 'Import',
    confirmButtonColor: 'green',

    preConfirm: () => {
      const input = document.getElementById('import-graph');
      if (input.value) {
        const file = input.files[0];
        const reader = new FileReader()
        reader.onload = (e) => {
          const backup = {
            nodes: Array.from(cy.elementMapper.nodes.values()),
            edges: Array.from(cy.elementMapper.edges.values()),
            info: info,
          };

          const data = {
            nodes: [],
            edges: [],
            info: info,
            cyImport: JSON.parse(e.target.result)
          };

          let vars = {}
          if (cy.vars) {
            const varsValues = {};
            Object.keys(cy.vars).forEach(k => {
              if (cy.vars[k].avoidInClone) {
                return;
              }
              varsValues[k] = {
                value: cy.vars[k].value,
              }
            });
            vars = structuredClone(varsValues);
          }
          cy = spawnGraph(getPanes()[cy.paneId], data, structuredClone(cy.params), vars);
          setPane(cy.paneId, true, true); // reset sidebar to new content
          dispatchEvent(new CustomEvent("global-action", {
            detail: {
              action: 'propagate',
            },
          }));
        }
        reader.readAsText(file);
      }
    }
  });
}

async function exportCy(cy, selection) {
  await Swal.fire({
    title: 'Export Model in Pane',
    text: 'Downloads Graph View content as .json',
    icon: 'warning',
    showCancelButton: true,
    showDenyButton: false,
    confirmButtonColor: 'green',
    cancelButtonColor: '#555',
    confirmButtonText: 'Download',
  }).then((result) => {
    if (result.isConfirmed) {
      const paneData = cy.json();

      if (selection) {
        let setSelect = new Set(selection)
        paneData.elements.nodes = paneData.elements.nodes.filter(node => {
          return setSelect.has(node.data.id) || !cy.vars['mode'].value.includes(node.data.type);
        });

        setSelect = new Set(paneData.elements.nodes.map(d => d.data.id));

        if (paneData.elements.edges) {
          paneData.elements.edges = paneData.elements.edges.filter(edge => {
            return setSelect.has(edge.data.source) && setSelect.has(edge.data.target)
          });
        }
      }

      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(paneData));
      const dl = document.getElementById('download');
      dl.setAttribute("href", dataStr);
      dl.setAttribute("download", `graph-${cy.paneId}.json`);
      dl.click();
    }
  });
}

// non-standard attempt to organize the 'public interface' of this js file
function setPublicVars(cy, preset) {
  cy.vars = {
    'ur': {
      value: cy.undoRedo(),
      avoidInClone: true, // workaround for structuredClone
      fn: cyUndoRedo,
    },
    'mode': {
      value: 's',
      fn: setSelectMode,
    },
    'details': {
      value: 'r',
      fn: updateDetailsToShow,
    },
    'scheduler': {
      value: undefined,
      fn: updateScheduler,
    },
  };

  cy.fns = {
    'import': importCy,
    'export': exportCy,
    'mark': mark,
    'undo-mark': unmark,
  };

  // call functions that need to be init
  if (Object.keys(preset).length === 0) {
    setSelectMode(cy, 's');
    updateDetailsToShow(cy, { update: false });
    updateScheduler(cy, '_none_');
  } else {
    setSelectMode(cy, preset['mode'].value);
    updateDetailsToShow(cy, { update: preset['details'].value });
    updateScheduler(cy, preset['scheduler'].value);
  }

}

export { spawnGraph }