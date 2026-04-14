const decisionTreeData = {
  nodes: [],
  edges: [],
};

const nodeInfoCache = new Map();

const impactCache = {
  probabilities: new Map(),
  classHierarchy: new Map(),
  hammingDistance: new Map(),
};
export async function initializeDecisionTree() {
  try {
    const treeResponse = await fetch('/API_outputs/DecisionTreeResponse/decision_tree.json');
    const treeNodes = await treeResponse.json();

    decisionTreeData.nodes = treeNodes.map(node => ({
      id: `node-${node.nodeId}`,
      label: node.axiomStr || `Leaf Node ${node.nodeId}`,
      axiom: node.axiomStr,
      nodeId: node.nodeId,
      parent: null,
      children: [],
    }));

    treeNodes.forEach(node => {
      if (node.yes !== undefined && node.yes !== null) {
        const yesChildId = `node-${node.yes}`;
        decisionTreeData.edges.push({
          id: `edge-${node.nodeId}-yes`,
          source: `node-${node.nodeId}`,
          target: yesChildId,
          label: 'keep',
          type: 'keep',
        });
        const yesChild = decisionTreeData.nodes.find(n => n.id === yesChildId);
        if (yesChild) {
          yesChild.parent = `node-${node.nodeId}`;
        }
      }

      if (node.no !== undefined && node.no !== null) {
        const noChildId = `node-${node.no}`;
        decisionTreeData.edges.push({
          id: `edge-${node.nodeId}-no`,
          source: `node-${node.nodeId}`,
          target: noChildId,
          label: 'remove',
          type: 'remove',
        });
        const noChild = decisionTreeData.nodes.find(n => n.id === noChildId);
        if (noChild) {
          noChild.parent = `node-${node.nodeId}`;
        }
      }
    });

    return decisionTreeData;
  } catch (error) {
    console.error('Error loading decision tree data:', error);
    throw error;
  }
}
export async function getNodeInfo(nodeId) {
  try {
    if (nodeInfoCache.has(nodeId)) {
      return nodeInfoCache.get(nodeId);
    }

    const response = await fetch(`/API_outputs/NodeInfoResponses/infoResponse_node_${nodeId}.json`);
    if (!response.ok) {
      throw new Error(`Failed to fetch node info for node ${nodeId}`);
    }

    const nodeInfo = await response.json();
    nodeInfoCache.set(nodeId, nodeInfo);
    return nodeInfo;
  } catch (error) {
    console.error(`Error loading node info for node ${nodeId}:`, error);
    return null;
  }
}
export async function getImpactProbabilities(nodeId) {
  try {
    if (impactCache.probabilities.has(nodeId)) {
      return impactCache.probabilities.get(nodeId);
    }

    const response = await fetch(`/API_outputs/Impact1Responses/probabilities_${nodeId}.json`);
    if (!response.ok) {
      throw new Error(`Failed to fetch probabilities for node ${nodeId}`);
    }

    const probabilities = await response.json();
    impactCache.probabilities.set(nodeId, probabilities);
    return probabilities;
  } catch (error) {
    console.error(`Error loading probabilities for node ${nodeId}:`, error);
    return null;
  }
}
export async function getClassHierarchyDifference(nodeId) {
  try {
    if (impactCache.classHierarchy.has(nodeId)) {
      return impactCache.classHierarchy.get(nodeId);
    }

    const response = await fetch(`/API_outputs/Impact2Responses/classHierarchyDifference_${nodeId}.json`);
    if (!response.ok) {
      throw new Error(`Failed to fetch class hierarchy for node ${nodeId}`);
    }

    const hierarchy = await response.json();
    impactCache.classHierarchy.set(nodeId, hierarchy);
    return hierarchy;
  } catch (error) {
    console.error(`Error loading class hierarchy for node ${nodeId}:`, error);
    return null;
  }
}
export async function getHammingDistance(nodeId) {
  try {
    if (impactCache.hammingDistance.has(nodeId)) {
      return impactCache.hammingDistance.get(nodeId);
    }

    const response = await fetch(`/API_outputs/Impact3Responses/hammingDistance_${nodeId}.json`);
    if (!response.ok) {
      throw new Error(`Failed to fetch hamming distance for node ${nodeId}`);
    }

    const distance = await response.json();
    impactCache.hammingDistance.set(nodeId, distance);
    return distance;
  } catch (error) {
    console.error(`Error loading hamming distance for node ${nodeId}:`, error);
    return null;
  }
}
export async function getNodeImpact(nodeId) {
  try {
    const [probabilities, hierarchy, distance] = await Promise.all([
      getImpactProbabilities(nodeId),
      getClassHierarchyDifference(nodeId),
      getHammingDistance(nodeId),
    ]);

    return {
      nodeId,
      probabilities,
      classHierarchy: hierarchy,
      hammingDistance: distance,
    };
  } catch (error) {
    console.error(`Error loading impact data for node ${nodeId}:`, error);
    return null;
  }
}
export function getDecisionTree() {
  return decisionTreeData;
}
export function getNextNodes(nodeId) {
  const edges = decisionTreeData.edges.filter(edge => 
    edge.source === `node-${nodeId}`
  );

  return edges.map(edge => ({
    target: edge.target,
    label: edge.label,
    type: edge.type,
  }));
}
export function getChildNodes(nodeId) {
  const children = decisionTreeData.nodes.filter(node => 
    node.parent === `node-${nodeId}`
  );
  return children;
}
export function getParentNode(nodeId) {
  const node = decisionTreeData.nodes.find(n => n.id === `node-${nodeId}`);
  if (node && node.parent) {
    return decisionTreeData.nodes.find(n => n.id === node.parent);
  }
  return null;
}

export default {
  initializeDecisionTree,
  getNodeInfo,
  getImpactProbabilities,
  getClassHierarchyDifference,
  getHammingDistance,
  getNodeImpact,
  getDecisionTree,
  getNextNodes,
  getChildNodes,
  getParentNode,
};
