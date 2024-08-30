package prism.core.View;

import org.jgrapht.Graph;
import org.jgrapht.alg.connectivity.GabowStrongConnectivityInspector;
import org.jgrapht.alg.cycle.DirectedSimpleCycles;
import org.jgrapht.alg.cycle.SzwarcfiterLauerSimpleCycles;
import org.jgrapht.alg.interfaces.StrongConnectivityAlgorithm;
import prism.core.Project;
import prism.core.mdpgraph.MdpGraph;
import prism.core.mdpgraph.MdpTransition;

import java.util.*;
import java.util.stream.Collectors;
import java.util.stream.Stream;

public class CycleView extends View {

    // number of nodes that a cycle is required to possess in order to be relevant for grouping (also max?)

    public enum Mode {Exact, JoinSet, Greedy}
    public enum GreedyMode {AscCycleSize, DescCycleSize, FoundOrder}

    public enum ActionMode {Same, Fixed}

    private Mode mode = Mode.JoinSet;
    private GreedyMode greedyMode = GreedyMode.DescCycleSize;

    private ActionMode actionMode = ActionMode.Same;
    private long minCycleSize = 3;
    // specifies if cycles transitions have to have a certain action
    private boolean checkActions = false;

    private boolean sccFilteringBefore = true;
    // action a cycle needs to contain
    private Set<String> cycleActions = null;

    private HashMap<List<Long>, String> actionOfCycle = new HashMap<>();
    // when an action is found for a cycle this one is put into the map and there is no further looking
    // if this cycle may also be possible with another action!

    // -> could be adapted (return true -> hasAction = true; String -> Set<String>)

    public CycleView(Project parent, long id, Collection<String> attributeSetter) throws Exception {
        super(parent, ViewType.CycleView, id);
        attributes.put("mode", mode);
        attributes.put("greedymode", greedyMode);
        attributes.put("actionmode", actionMode);
        attributes.put("mincyclesize", minCycleSize);
        attributes.put("checkactions", checkActions);
        attributes.put("cycleactions", cycleActions);
        setAndPutAtt("semiGrouping", false);
        attributes.putAll(setAttributes(attributeSetter));
    }

//    public CycleView(Project parent, long id) { super(parent, ViewType.CycleView, id); }

//    public CycleView(Project parent, long id, String mode, String greedyMode) {
//        super(parent, ViewType.CycleView, id);
//        this.mode = this.mode.name().equals(mode) ? Enum.valueOf(Mode.class, mode) : Mode.Exact;
//        this.greedyMode = this.mode.name().equals(greedyMode) ? Enum.valueOf(GreedyMode.class, mode) : GreedyMode.DescCycleSize;
//    }

    @Override
    protected Map<String, Object> assignAttributes(String attName, String attValue) throws Exception {
        Map<String, Object> modifiedAttributes = new HashMap<>();
        attName = attName.toLowerCase();
        switch (attName) {
            case "mode":
                mode = Mode.valueOf(attValue);
                modifiedAttributes.put(attName, mode);
                break;
            case "greedymode":
                greedyMode = GreedyMode.valueOf(attValue);
                modifiedAttributes.put(attName, greedyMode);
                break;
            case "actionmode":
                actionMode = ActionMode.valueOf(attValue);
                modifiedAttributes.put(attName, actionMode);
                break;
            case "mincyclesize":
                minCycleSize = Integer.parseInt(attValue);
                modifiedAttributes.put(attName, minCycleSize);
                break;
            case "checkactions":
                checkActions = myParseBoolean(attValue);
                modifiedAttributes.put(attName, checkActions);
                break;
            case "sccfilterbefore":
                sccFilteringBefore = myParseBoolean(attValue);
                modifiedAttributes.put(attName, sccFilteringBefore);
                break;
            case "cycleactions":
                if (attValue.equalsIgnoreCase("remove")) {
                    cycleActions = new HashSet<>();
                } else {
                    cycleActions = new HashSet<>(Arrays.asList(attValue.split(",")));
                }
                modifiedAttributes.put(attName, cycleActions);
                break;
            default:
                throw new RuntimeException(attName);
        }

        return modifiedAttributes;
    }
    @Override

    public List<String> groupingFunction() {
        List<String> toExecute = new ArrayList<>();

        MdpGraph mdpGraph = model.getMdpGraph();
        StrongConnectivityAlgorithm<Long, Long> strongConAlg;
        List<Graph<Long, Long>> components;

        // create subgraph intended only for jGraphT-algorithms being run on it
        Graph<Long, Long> algoSubgraph = createAlgoSubgraph(mdpGraph);
        if (sccFilteringBefore) {
            strongConAlg = new GabowStrongConnectivityInspector<>(algoSubgraph);
            components =
                    strongConAlg.getStronglyConnectedComponents()
                            .stream()
                            .filter(strongConComp -> strongConComp.vertexSet().size() >= minCycleSize)
                            .collect(Collectors.toList());
        }
        else {
            components = List.of(algoSubgraph);
        }
        // TODO insert condition when not to execute (largest strongly connected component too large)
        for (Graph<Long, Long> strongConComp : components) {

                // works: tiernan, SzwarcfiterLauer, Tarjan
                // doesnt work: johnson (due multigraph)
                DirectedSimpleCycles<Long, Long> cycleDetector = new SzwarcfiterLauerSimpleCycles<>(strongConComp);

                List<List<Long>> cycles = cycleDetector.findSimpleCycles();
                if (cycleActions == null && actionMode.equals(ActionMode.Fixed)) {
                    checkActions = false; // cant check for fixed actions if there are none
                    // alternative behavior: cancel build
                }
                cycles = cycles.stream()
                        .filter(cycle -> cycle.size() >= minCycleSize)
                        .filter(cycle -> { // filter cycles that meet requirement to action

                            // requirements disabled
                            if (!checkActions) return true;

                            switch (actionMode) {

                                // there is a set of permitted actions
                                // that the transitions of the cycle have to consist of
                                // most of the time: Singleton set: one specific action permitted
                                case Fixed:
                                    for (String action : cycleActions) {
                                        boolean cycleHasAction = checkCycleAction(mdpGraph, cycle, action);
                                        if (cycleHasAction) {
                                            actionOfCycle.put(cycle, action);
                                            return true;
                                        }
                                    }

                                // for each cycle there must exist an action that is present between
                                // each two states of the cycle
                                case Same: default:
                                    // get the smallest set of actions that exists between two nodes of the cycle
                                    // -> checkCycleAction is executed as little as possible

                                    // determine the set of actions between each consecutive pair of states in the cycle
                                    SortedSet<Set<String>> actionSetsOfPairOfStates = new TreeSet<>(Comparator.comparing(Set::size));
                                    Long stateId1;
                                    long stateId2;
                                    for (int i = 0; i < cycle.size(); i++) {
                                        stateId1 = cycle.get(i);
                                        stateId2 = cycle.get((i+1) % cycle.size());
                                        Set<String> actionsFromStateOneToTwo =
                                                mdpGraph
                                                        .getAllEdges(stateId1, stateId2)
                                                        .stream()
                                                        .map(mdpGraph::getTransObj)
                                                        .map(MdpTransition::getAction)
                                                        .collect(Collectors.toSet());
                                        actionSetsOfPairOfStates.add(actionsFromStateOneToTwo);
                                    }

                                    // choose the set with the least actions
                                    // -> restricts the possible actions that the whole cycle must have the most
                                    Set<String> smallestSetOfActions = actionSetsOfPairOfStates.first();

                                    // check if there exists an action that is present between each two states of the cycle
                                    for (String action : smallestSetOfActions) {
                                        boolean cycleHasSameAction = checkCycleAction(mdpGraph, cycle, action);
                                        if (cycleHasSameAction) {
                                            actionOfCycle.put(cycle, action);
                                            return true;
                                        }
                                    }
                                    return false;
                            }
                        }
                        )
                        .collect(Collectors.toList()); // filtered cycles

                switch (mode) {

                    // label state with the list of cycles it is in
                    case Exact:
                        for (Long stateId : relevantStates) {
                            List<List<Long>> cycleList = cycles.stream()
                                    .filter(cycle -> cycle.contains(stateId))
                                    .collect(Collectors.toList());

                            // prepare String representation, TreeSet so that Order of Cycles does not matter (all ordered equally)
                            Set<String> cycleStringSet = cycleList.stream()
                                    .map(ArrayList::new)
                                    .map(cycle -> cycle.toString() + actionOfCycle.getOrDefault(cycle, ""))
                                    .collect(Collectors.toCollection(TreeSet::new));
                            String cycleString = semiGrouping && cycleStringSet.isEmpty() ? ENTRY_C_BLANK : cycleStringSet.toString();
                            toExecute.add(String.format("UPDATE %s SET %s = '%s' WHERE %s = '%s'",
                                    model.getStateTableName(), getCollumn(), cycleString, ENTRY_S_ID, stateId));
                        }
                        break;

                    // label STATE with the union of the states of the cycles, the STATE is in
                    case JoinSet:
                        for (Long stateId : relevantStates) {
                            SortedSet<Long> cycleNodes = cycles.stream()
                                    .filter(cycle -> cycle.contains(stateId))
                                    .flatMap(Collection::stream)
                                    .collect(Collectors.toCollection(TreeSet::new));
                            String cycleString = semiGrouping && cycleNodes.isEmpty() ? ENTRY_C_BLANK : cycleNodes.toString();
                            toExecute.add(String.format("UPDATE %s SET %s = '%s' WHERE %s = '%s'", model.getStateTableName(), getCollumn(), cycleString, ENTRY_S_ID, stateId));
                        }
                        break;

                    // assign state to exactly one cycle -> greedy
                    case Greedy:
                        Map<Long, List<Long>> stateToCycle = new HashMap<>();
                        Stream<List<Long>> cycleStream = cycles.stream();

                        // sort cycleStream to choose greedyMode
                        Comparator<List<Long>> cycleSizeComp = Comparator.comparing(List::size);
                        switch (greedyMode) {
                            case AscCycleSize:
                                cycleStream = cycleStream.sorted(cycleSizeComp);
                                break;
                            case DescCycleSize:
                                cycleStream = cycleStream.sorted(cycleSizeComp.reversed());
                                break;
                            case FoundOrder:
                            default:
                                break;
                        }

                        // assign states to cycle if none of them already contained in another cycle
                        cycleStream.reduce(List.of(), (statesInCycle, curCycle) -> {

                            // no state included in other cycle yet -> all states in cycle labeled with that cycle
                            if (curCycle.stream().noneMatch(statesInCycle::contains)) {
                                curCycle.forEach(stateId -> stateToCycle.put(stateId, curCycle));
                                return Stream.concat(statesInCycle.stream(), curCycle.stream()).collect(Collectors.toList());
                            }

                            // exists state in cycle that is already in another cycle -> discard cycle
                            else {
                                return statesInCycle;
                            }
                        });

                        // add all SQL statements to toExecute
                        List<Long> emptyList = List.of();
                        for (Long stateId : relevantStates) {
                            List<Long> cycle = stateToCycle.getOrDefault(stateId, emptyList);
                            String cycleString = semiGrouping && cycle.isEmpty() ? ENTRY_C_BLANK : cycle.toString() + actionOfCycle.getOrDefault(cycle, "");
                            toExecute.add(String.format("UPDATE %s SET %s = '%s' WHERE %s = '%s'",
                                    model.getStateTableName(), getCollumn(), cycleString, ENTRY_S_ID, stateId));
                        }
                        break;
                }
            }

        return toExecute;
    }

//    // old previous version
//    private List<String> createViewWithMdpGraphObj(List<String> toExecute) {
//        MdpGraphOld mdpGraph = model.getMdpGraph();
////            System.out.println("###################################1##############################################");
////            System.out.println(new TreeSet<>(mdpGraph.edgeSet().stream().map(MdpTransitionOld::toString).collect(Collectors.toSet())));
////            System.out.println("###################################2##############################################");
//
//
//            DirectedSimpleCycles<State, MdpTransitionOld> cycleDetector = new SzwarcfiterLauerSimpleCycles<>(mdpGraph);
//
//            List<List<State>> cycles = cycleDetector.findSimpleCycles();
//
////            System.out.println("Number of sttates: " + mdpGraph.statesSet().size());
//            for (State state : mdpGraph.stateSet()) {
//                List<List<State>> cycleList = new ArrayList<>();
//                for (List<State> cycle : cycles) {
//                    if (cycle.contains(state) && cycle.size() >= minCycleSize) {
//                        cycleList.add(cycle);
//                    }
//                }
//                List<List<String>> cycleListStateId = cycleList.stream().map(s -> s.stream().map(State::getId).collect(Collectors.toList())).collect(Collectors.toList());
//
//                // make Cycles to Strings, sort them in TreeSet, convert TreeSet to String
//                String cycleString = (new TreeSet<>(cycleListStateId.stream().map(s -> new ArrayList<>(s).toString()).collect(Collectors.toList()))).toString();
//                cycleString = semiGrouping && cycleString.equals("[]") ? state.getId() : cycleString;
//                toExecute.add(String.format("UPDATE %s SET %s = '%s' WHERE %s = '%s'", model.getStateTableName(), getCollumn(), cycleString, ENTRY_S_ID, state.getNumId()));
//            }
//            return toExecute;
//    }

    @Override
    public String getCollumn() {
        return ViewType.CycleView.name();
    }

    private boolean checkCycleAction(MdpGraph mdpGraph, List<Long> cycle, String cycleAction) {
        if (cycle.size() == 1) {
            Long stateId1 = cycle.get(0);
            if (actionMode.equals(ActionMode.Fixed))
                return mdpGraph.getAllEdges(stateId1, stateId1)
                        .stream()
                        .map(mdpGraph::getTransObj)
                        .map(MdpTransition::getAction)
                        .anyMatch(action -> cycleActions.contains(action));
            else {
                return true;
            }
        }

        // cycle.size() > 1
        // check edge between first and last state of cycle
        Long stateId1;
        long stateId2;
        for (int i = 0; i < cycle.size(); i++) {
            stateId1 = cycle.get(i);
            stateId2 = cycle.get((i+1) % cycle.size());

            boolean cycleHasAction = mdpGraph.getAllEdges(stateId1, stateId2)
                    .stream()
                    .map(mdpGraph::getTransObj)
                    .map(MdpTransition::getAction)
                    .anyMatch(action -> action.equals(cycleAction));
            if (!cycleHasAction) {
                return false;
            }
        }
        return true;
    }

}
