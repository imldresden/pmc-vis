package prism.core.View;

import org.jgrapht.alg.connectivity.ConnectivityInspector;
import org.jgrapht.graph.DefaultUndirectedGraph;
import prism.core.Project;
import prism.core.mdpgraph.MdpGraph;
import prism.core.mdpgraph.MdpTransition;

import java.util.*;
import java.util.stream.Collectors;


/**
 * View that views all states with the same atomic propositions (or as prism calls them, labels) together.
 */
public class CollapseDualDirTransView extends View {

    public CollapseDualDirTransView(Project parent, long id){
        super(parent, ViewType.CollapseDualDirTransView, id);
    }

    public CollapseDualDirTransView(Project parent, long id, Collection<String> attributeSetter) throws Exception {
        super(parent, ViewType.CollapseDualDirTransView, id, attributeSetter);
    }

    @Override
    protected List<String> groupingFunction() {
        List<String> toExecute = new ArrayList<>();

        MdpGraph mdpGraph = model.getMdpGraph();
        HashMap<String, DefaultUndirectedGraph<Long,Long>> doubleActionToGraph = new HashMap<>();

        // insert double edges into mdpGraphDoubleTrans
        // if (mdpGraph.edgeSet().size() <= (mdpGraph.stateSet().size()^2)) {
        for (Long mdpTrans : relevantStates) {
            MdpTransition mdpTransObj = mdpGraph.getTransObj(mdpTrans);
            Long sourceStateId = mdpTransObj.getSource();
            Long targetStateId = mdpTransObj.getTarget();
            // add all trans from source to target as MDPTransLean object
            Set<MdpTransition> allMdpTrans = mdpGraph.getAllEdges(sourceStateId, targetStateId)
                    .stream()
                    .map(mdpGraph::getTransObj)
                    .collect(Collectors.toSet());
            // add all trans from target to source as MDPTransLean object
            allMdpTrans.addAll(mdpGraph.getAllEdges(targetStateId, sourceStateId)
                    .stream()
                    .map(mdpGraph::getTransObj)
                    .collect(Collectors.toSet())
            );
            // build graphs for every action-name if there is at least one pair of nodes with double directed edges with this action
            Set<MdpTransition> allMdpTransDeepCopy = new HashSet<>(allMdpTrans);
            allMdpTrans
                    .stream()
                    .filter(trans -> trans.getSource().equals(trans.getTarget()) ||
                            allMdpTransDeepCopy.stream().anyMatch(
                                    otherTrans ->
                                            !otherTrans.equals(trans)
                                                    && otherTrans.getAction().equals(trans.getAction())
                                                    && otherTrans.getSource().equals(trans.getTarget())
                                                    && otherTrans.getTarget().equals(trans.getSource())
                            )
                    )
                    .forEach(trans -> {
                                DefaultUndirectedGraph<Long, Long> doubleActionGraph = doubleActionToGraph.get(trans.getAction());

                                if (doubleActionGraph == null) {
                                    doubleActionGraph = new DefaultUndirectedGraph<>(Long.class);
                                    doubleActionToGraph.put(trans.getAction(), doubleActionGraph);

                                }
                                // due to DefaultUndirectedGraph insertion of same edge several times will only happen once
                                doubleActionGraph.addVertex(sourceStateId);
                                doubleActionGraph.addVertex(targetStateId);
                                doubleActionGraph.addEdge(sourceStateId, targetStateId, trans.getId());
                            });
        }

        // map to display the action in the String
        HashMap<Set<Long>, String> graphToDoubleAction = new HashMap<>();
        // add all components in one list that is later being sorted
        List<Set<Long>> sorted2DirEdgeComponents = new ArrayList<>();
        for (String action : doubleActionToGraph.keySet()) {
            Set<Set<Long>> connectedSets = new ConnectivityInspector<>(doubleActionToGraph.get(action))
                    .connectedSets()
                    .stream()
                    .filter(conSet -> conSet.size() > 1)
                    .collect(Collectors.toSet());
            for (Set<Long> connectedSet : connectedSets) {
                graphToDoubleAction.put(connectedSet, action);
            }
            sorted2DirEdgeComponents.addAll(connectedSets);
        }

        // sorting modes could be added here, CURRENTLY: Desc
        sorted2DirEdgeComponents.sort(Comparator.comparing(Set::size));
        Collections.reverse(sorted2DirEdgeComponents);

        // assign state to conComp only asserting every state to exactly one
        Set<Long> notYetAssignedToConComp = new HashSet<>(mdpGraph.stateSet());
        for (Set<Long> connectedComp : sorted2DirEdgeComponents) {
            if (notYetAssignedToConComp.containsAll(connectedComp)) {
                notYetAssignedToConComp.removeAll(connectedComp);
                for (Long stateId : connectedComp) {
                    String doubleDirEdgeString = graphToDoubleAction.get(connectedComp) + ": " + connectedComp;
                    toExecute.add(String.format(
                            "UPDATE %s SET %s = '%s' WHERE %s = '%s'",
                            model.getStateTableName(), getCollumn(), doubleDirEdgeString, ENTRY_S_ID, stateId
                    ));
                }
            }
        }

        // assign other states
        for (Long stateId : notYetAssignedToConComp) {
            String doubleDirEdgeString = semiGrouping ? ENTRY_C_BLANK : "";
            toExecute.add(String.format(
                    "UPDATE %s SET %s = '%s' WHERE %s = '%s'",
                    model.getStateTableName(), getCollumn(), doubleDirEdgeString, ENTRY_S_ID, stateId
            ));
        }

        return toExecute;
    }

    @Override
    public String getCollumn() {
        return ViewType.CollapseDualDirTransView.name();
    }





//    DefaultUndirectedGraph<Long, Long> graphOnlyDoubleTrans = new DefaultUndirectedGraph<>(Long.class);
//
//    // insert double edges into mdpGraphDoubleTrans
//            if (mdpGraphLean.edgeSet().size() <= (mdpGraphLean.stateSet().size()^2)) {
//        for (Long mdpTrans : mdpGraphLean.edgeSet()) {
//            MdpTransition mdpTransObj = mdpGraphLean.getTransObj(mdpTrans);
//            Long sourceStateId = mdpTransObj.getSource();
//            Long targetStateId = mdpTransObj.getTarget();
//            if (!graphOnlyDoubleTrans.containsEdge(sourceStateId, targetStateId)
//                    && mdpGraphLean.containsEdge(sourceStateId, targetStateId)
//                    && mdpGraphLean.containsEdge(targetStateId, sourceStateId)) {
//                graphOnlyDoubleTrans.addEdge(sourceStateId, targetStateId);
//                // add all trans from source to target as MDPTransLean object
//                Set<MdpTransition> allMdpTrans = mdpGraphLean.getAllEdges(sourceStateId, targetStateId)
//                        .stream()
//                        .map(mdpGraphLean::getTransObj)
//                        .collect(Collectors.toSet());
//                // add all trans from target to source as MDPTransLean object
//                allMdpTrans.addAll(mdpGraphLean.getAllEdges(targetStateId, sourceStateId)
//                        .stream()
//                        .map(mdpGraphLean::getTransObj)
//                        .collect(Collectors.toSet()));
//                // add transitions to graph that have a transition in the other direction with the same action
//                allMdpTrans
//                        .stream()
//                        .filter(trans -> allMdpTrans.stream().anyMatch(
//                                        otherTrans ->
//                                                !otherTrans.equals(trans)
//                                                        && otherTrans.getAction().equals(trans.getAction())
//                                                        && otherTrans.getSource().equals(trans.getTarget())
//                                                        && otherTrans.getTarget().equals(trans.getSource())
//                                )
//                        )
//                        .collect(Collectors.toSet())
//                        .forEach(trans -> mdpGraphDoubleTrans.addEdge(sourceStateId, targetStateId));
//
//            }
//        }
//    }

//    MdpGraph mdpGraphDoubleTrans = new MdpGraph(new ArrayList<>(), new ArrayList<>());
//    // if (mdpGraphLean.edgeSet().size() <= (mdpGraphLean.stateSet().size()^2)) {
//            for (Long mdpTrans : mdpGraphLean.edgeSet()) {
//        MdpTransition mdpTransObj = mdpGraphLean.getTransObj(mdpTrans);
//        Long sourceStateId = mdpTransObj.getSource();
//        Long targetStateId = mdpTransObj.getTarget();
//        if (!mdpGraphDoubleTrans.containsEdge(sourceStateId, targetStateId)) {
//            // add all trans from source to target as MDPTransLean object
//            Set<MdpTransition> allMdpTrans = mdpGraphLean.getAllEdges(sourceStateId, targetStateId)
//                    .stream()
//                    .map(mdpGraphLean::getTransObj)
//                    .collect(Collectors.toSet());
//            // add all trans from target to source as MDPTransLean object
//            allMdpTrans.addAll(mdpGraphLean.getAllEdges(targetStateId, sourceStateId)
//                    .stream()
//                    .map(mdpGraphLean::getTransObj)
//                    .collect(Collectors.toSet())
//            );
//            // add transitions to graph that have a transition in the other direction with the same action
//            allMdpTrans
//                    .stream()
//                    .filter(trans -> trans.getSource().equals(trans.getTarget()) ||
//                            allMdpTrans.stream().anyMatch(
//                                    otherTrans ->
//                                            !otherTrans.equals(trans)
//                                                    && otherTrans.getAction().equals(trans.getAction())
//                                                    && otherTrans.getSource().equals(trans.getTarget())
//                                                    && otherTrans.getTarget().equals(trans.getSource())
//                            )
//                    )
//                    .forEach(trans -> mdpGraphDoubleTrans.addTransition(sourceStateId, targetStateId, trans.getId()));
//        }
//    }
//
//
//    ConnectivityInspector<Long, Long> conInspector = new ConnectivityInspector<>(mdpGraphDoubleTrans);
//    List<Set<Long>> blocks = conInspector.connectedSets();
//
//            for (Set<Long> block : blocks) {
//        Set<Long> toVisit = block;
//        Map<Long, List<String>> something = new HashMap<>();
//        Long curStateId = toVisit.iterator().next();
//        toVisit.remove(curStateId);
//
//        while (!toVisit.isEmpty()) {
//            if (curStateId == null) {
//                // find neighbour
//            }
//            List<Long> neighbours = mdpGraphDoubleTrans.outgoingEdgesOf(curStateId)
//                    .stream()
//                    .map(mdpGraphLean::getTransObj)
//                    .map(MdpTransition::getTarget)
//                    .collect(Collectors.toList());
//
//            while (!neighbours.isEmpty()) {
//                Long neighbour = neighbours.remove(neighbours.size() - 1);
//                Set<String> actions = mdpGraphDoubleTrans.getAllEdges(curStateId, neighbour)
//                        .stream()
//                        .map(mdpGraphLean::getTransObj)
//                        .map(MdpTransition::getAction)
//                        .collect(Collectors.toSet());
//
//                while (!actions.isEmpty()) {
//                    String action = actions.iterator().next();
//                    actions.remove(action);
//                    // dfs
//                }
//            }
//        }
}
