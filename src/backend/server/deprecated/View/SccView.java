package prism.core.View;

import org.jgrapht.Graph;
import org.jgrapht.alg.connectivity.GabowStrongConnectivityInspector;
import org.jgrapht.alg.connectivity.KosarajuStrongConnectivityInspector;
import org.jgrapht.alg.interfaces.StrongConnectivityAlgorithm;
import prism.core.Project;
import prism.core.mdpgraph.MdpGraph;

import java.util.*;
import java.util.stream.Collectors;

public class SccView extends View {

    // both algorithms run in O(V + E)
    private enum Algorithm {Gabow, Kosaraju}

    private Algorithm algorithm = Algorithm.Gabow;

    private long minCompSize = 2;

    public SccView(Project parent, long id, Collection<String> attributeSetter) throws Exception {
        super(parent, ViewType.SccView, id);
        attributes.putAll(setAttributes(attributeSetter));
    }

    protected Map<String, Object> assignAttributes(String attName, String attValue) throws Exception {
        Map<String, Object> modifiedAttributes = new HashMap<>();
        attName = attName.toLowerCase();
        switch (attName) {
            case "algorithm":
                algorithm = SccView.Algorithm.valueOf(attValue);
                modifiedAttributes.put(attName, algorithm);
                break;
            case "mincompsize":
                minCompSize = Integer.parseInt(attValue);
                modifiedAttributes.put(attName, minCompSize);
                break;
                default:
                modifiedAttributes.put("Error", "Could not find attribute " + attName);
        }

        return modifiedAttributes;
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

        List<Set<Long>> strongConComps = strongConAlg.stronglyConnectedSets();
        strongConComps = strongConComps.stream().filter(comp -> comp.size() >= minCompSize).collect(Collectors.toList());

        for (Long stateId : relevantStates) {
            Set<String> strongConCompsState = strongConComps.stream()
                    .filter(strongConComp -> strongConComp.contains(stateId))
                    .map(Object::toString)
                    .collect(Collectors.toCollection(TreeSet::new));
            String strongConCompString = semiGrouping && strongConCompsState.isEmpty() ? ENTRY_C_BLANK : strongConCompsState.toString();
            toExecute.add(String.format(
                    "UPDATE %s SET %s = '%s' WHERE %s = '%s'",
                    model.getStateTableName(), getCollumn(), strongConCompString, ENTRY_S_ID, stateId
            ));
        }

//        if (model.debug) {
//            System.out.println("########################################################################");
//            System.out.println("stateSet: " + mdpGraph.stateSet());
//            System.out.println("toExecute: " + toExecute);
//            System.out.println("########################################################################");
//        }

        return toExecute;
    }

    @Override
    public String getCollumn() {
        return ViewType.SccView.name();
    }

}
