package prism.core.View;

import org.jgrapht.Graph;
import org.jgrapht.alg.cycle.DirectedSimpleCycles;
import org.jgrapht.alg.cycle.SzwarcfiterLauerSimpleCycles;
import prism.core.Project;
import prism.core.mdpgraph.MdpGraph;

import java.util.*;
import java.util.stream.Collectors;

public class CycleHasView extends View {

    // number of nodes that a cycle is required to possess in order to be relevant for grouping (also max?)

    private enum Mode {Exact, JoinSet, Greedy}
    private enum GreedyMode {AscCycleSize, DescCycleSize, foundOrder}

    private Mode mode = Mode.Exact;
    private GreedyMode greedyMode = GreedyMode.DescCycleSize;
    private long minCycleSize = 3;

    // specifies if cycles transitions have to have a certain action

    @Override
    protected Map<String, Object> assignAttributes(String attName, String attValue) {
        attName = attName.toLowerCase();
        Map<String, Object> modifiedAttributes = new HashMap<>();
        switch (attName) {
            case "mode":
                mode = CycleHasView.Mode.valueOf(attValue);
                modifiedAttributes.put(attName, mode);
                break;
            case "greedymode":
                greedyMode = CycleHasView.GreedyMode.valueOf(attValue);
                modifiedAttributes.put(attName, greedyMode);
                break;
            case "mincyclesize":
                minCycleSize = Integer.parseInt(attValue);
                modifiedAttributes.put(attName, minCycleSize);
                break;
            default:
                throw new RuntimeException(attName);
        }
        return modifiedAttributes;
    }

    public CycleHasView(Project parent, long id) { super(parent, ViewType.CycleHasView, id); }

    public CycleHasView(Project parent, long id, Collection<String> attributeSetter) throws Exception { super(parent, ViewType.CycleHasView, id, attributeSetter); }

    public CycleHasView(Project parent, long id, String mode, String greedyMode) {
        super(parent, ViewType.CycleView, id);
        this.mode = this.mode.name().equals(mode) ? Enum.valueOf(Mode.class, mode) : Mode.Exact;
        this.greedyMode = this.mode.name().equals(greedyMode) ? Enum.valueOf(GreedyMode.class, mode) : GreedyMode.DescCycleSize;
    }

    @Override
    protected List<String> groupingFunction() {
        List<String> toExecute = new ArrayList<>();

        MdpGraph mdpGraph = model.getMdpGraph();

        // create subgraph intended only for jGraphT-algorithms being run on it
        Graph<Long, Long> algoSubgraph = createAlgoSubgraph(mdpGraph);

//            CycleDetector<Long, Long> cycleDetector = new CycleDetector<>(algoSubgraph); // could be used if min cycle
        DirectedSimpleCycles<Long, Long> cycleDetector = new SzwarcfiterLauerSimpleCycles<>(algoSubgraph);
        List<List<Long>> cycles = cycleDetector.findSimpleCycles();
        Set<Long> cycleStates = cycles
                .stream()
                .filter(cycle -> cycle.size() >= minCycleSize)  // filter for actions could be copied from
                .flatMap(Collection::stream)                    // CycleView.java if actions are of interest
                .collect(Collectors.toSet());

        for (Long stateId : relevantStates) {
            boolean hasProperty = cycleStates.contains(stateId);
            String cycleGroupingString = calcBinGroupingString(hasProperty, "cycle", "~cycle");
//            if (semiGrouping){
//                switch (binaryMode) {
//                    case HIDE:
//                        cycleGroupingString = cycleStates.contains(stateId) ? "inCycle" : ENTRY_C_BLANK;
//                        break;
//                    case SHOW: default:
//                        cycleGroupingString = cycleStates.contains(stateId) ? ENTRY_C_BLANK : "notInCycle";
//                        break;
//                }
//            }
//            else {
//                cycleGroupingString = cycleStates.contains(stateId) ? "inCycle" : "notInCycle";
//            }
            toExecute.add(String.format(
                    "UPDATE %s SET %s = '%s' WHERE %s = '%s'",
                    model.getStateTableName(), getCollumn(), cycleGroupingString, ENTRY_S_ID, stateId
            ));
        }

        return toExecute;
    }

    @Override
    public String getCollumn() {
        return ViewType.CycleHasView.name();
    }
}
