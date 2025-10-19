package prism.core.View;

import org.jgrapht.Graph;
import org.jgrapht.alg.connectivity.GabowStrongConnectivityInspector;
import org.jgrapht.alg.connectivity.KosarajuStrongConnectivityInspector;
import org.jgrapht.alg.interfaces.StrongConnectivityAlgorithm;
import prism.core.Project;
import prism.core.mdpgraph.MdpGraph;

import java.util.*;
import java.util.stream.Collectors;

public class SccbView extends View {

    // both algorithms run in O(V + E)
    private enum Algorithm {Gabow, Kosaraju}

    private Algorithm algorithm = Algorithm.Gabow;

    private boolean semiGrouping = true;

    private long minCompSize = 2;

    public SccbView(Project parent, long id, Collection<String> attributeSetter) throws Exception {
        super(parent, ViewType.SccbView, id, attributeSetter);
    }

    public SccbView(Project parent, long id){
        super(parent, ViewType.SccbView, id);
    }

    @Override
    protected List<String> groupingFunction() {
        List<String> toExecute = new ArrayList<>();

        MdpGraph mdpGraph = model.getMdpGraph();

        // subgraph only intended jGraphT-algorithms being run on it
        // node set is exactly relevantStates
        Graph<Long, Long> algoSubgraph = createAlgoSubgraph(mdpGraph);

        StrongConnectivityAlgorithm<Long, Long> strongConAlg;

        switch (algorithm) {
            case Kosaraju:
                strongConAlg = new KosarajuStrongConnectivityInspector<>(algoSubgraph);
                break;
            case Gabow: default:
                strongConAlg = new GabowStrongConnectivityInspector<>(algoSubgraph);
                break;
        }


        // only part differing from SccView -> could be merged with if statement
        List<Set<Long>> btmStrongConComps = strongConAlg.stronglyConnectedSets().stream()
                .filter(comp -> comp.size() >= minCompSize)
                // check bottom strongly connected
                .filter(comp -> comp.stream()
                        // for all nodes of the component
                        .allMatch(stateId -> mdpGraph.outgoingEdgesOf(stateId).stream()
                                // all target states of outgoing edges are in the component
                                .allMatch(trans -> comp.contains(mdpGraph.getEdgeTarget(trans))))                    )
                .collect(Collectors.toList());

        for (Long stateId : relevantStates) {
            Set<String> btmStrongConCompsState = btmStrongConComps.stream()
                    .filter(strongConComp -> strongConComp.contains(stateId))
                    .map(Object::toString)
                    .collect(Collectors.toCollection(TreeSet::new));
            String btmStrongConCompString = semiGrouping && btmStrongConCompsState.isEmpty() ? ENTRY_C_BLANK : btmStrongConCompsState.toString();
            toExecute.add(String.format(
                    "UPDATE %s SET %s = '%s' WHERE %s = '%s'",
                    model.getStateTableName(), getCollumn(), btmStrongConCompString, ENTRY_S_ID, stateId
            ));
        }

        return toExecute;
    }

    @Override
    public String getCollumn() {
        return ViewType.SccbView.name();
    }

}

