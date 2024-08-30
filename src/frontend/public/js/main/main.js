import { calcPaneDims, spawnPane, info } from "../views/panes.js";
import { params }  from "../views/node-link/layout-options/elk.js";
import { spawnGraph } from "../views/node-link/node-link.js";
import { PROJECT } from "../utils/controls.js";

window.onresize = () => {
  dispatchEvent(new CustomEvent("paneResize", {
    detail: {
        pane: 'all',
    },
  }));
}

Promise.all([
  fetch('http://localhost:8080/'+ PROJECT +'/initial').then((res) => res.json()),
  //fetch('http://localhost:8080/'+ PROJECT).then((res) => res.json()) // requests entire dataset
]).then((promises) => {
    const data = promises[0];
    //console.log(data)
    
    Object.keys(data.nodes[0].details).forEach(k => {
      if (data.info[k]) {
        info[k] = data.info[k];
        delete data.info[k];
      }
    });
    info.metadata = data.info;
    delete data.info;

    Object.keys(info.metadata).forEach(k => {
      if (k === 'ID') {
        document.getElementById('project-id').innerHTML = info.metadata[k];
      } else {
        const p = document.createElement('p')
        p.innerHTML = k + ": " + info.metadata[k];
        document.getElementById('info-box').appendChild(p);
      }
    });

    const firstPaneId = "pane-0";
    const pane = spawnPane(
      calcPaneDims(data.nodes.length), 
      { id: firstPaneId } 
    );
    
    spawnGraph(pane, data, params);
});




