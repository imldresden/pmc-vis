package prism.core.View;

import prism.core.Project;
import prism.core.mdpgraph.MdpGraph;

import java.util.*;
import java.util.stream.Collectors;

public class ReachabilityView extends View {

//    private String identifierExpression = "init";
    protected BinaryMode binaryMode = BinaryMode.HIDE;

    private long maxDistance = -1;

    public ReachabilityView(Project parent, long id, Collection<String> attributeSetter) throws Exception {
        super(parent, ViewType.ReachabilityView, id);
//        attributes.put("identexpression", identifierExpression);
        attributes.put("binmode", binaryMode);
        MdpGraph mdpGraph = model.getMdpGraph();
        relevantStates = mdpGraph.stateSet()
                .stream()
                .filter(stateId -> mdpGraph.getStateObj(stateId).isFinal())
                .collect(Collectors.toSet());
        attributes.putAll(setAttributes(attributeSetter));
    }

    @Override
    protected Map<String, Object> assignAttributes(String attName, String attValue) throws Exception {
        Map<String, Object> modifiedAttributes = new HashMap<>();
        attName = attName.toLowerCase();
        switch (attName) {
            case "identifierexpression":
            case "identexpression":
//            case "identexpr":
//                identifierExpression = attValue;
//                modifiedAttributes.put("identexpression", identifierExpression);
//                break;
            case "maxdist":
            case "maxdistance":
                maxDistance = Long.parseLong(attValue);
                modifiedAttributes.put("maxdistance", maxDistance);
                break;
            default:
                modifiedAttributes.put("Error", "Could not find attribute " + attName);
        }
        return modifiedAttributes;
    }

    @Override
    protected List<String> groupingFunction() throws Exception {
        List<String> toExecute = new ArrayList<>();

        // Compute reachability score
        Set<Long> visited = new HashSet<>();
        Set<Long> visiting = new HashSet<>();

        // Initialise states with expression
//        if (identifierExpression.equals("init")){
//            Set<Long> subsetInitStates = model.getInitialStates()
//                    .stream()
//                    .filter(stateId -> relevantStates.contains(stateId))
//                    .collect(Collectors.toSet());
//            visiting.addAll(subsetInitStates);
//        } else {
//            Set<Long> subsetStates = model.getStatesByExpression(model.parseSingleExpressionString(identifierExpression).toString())
//                    .stream()
//                    .filter(stateId -> relevantStates.contains(stateId))
//                    .collect(Collectors.toSet());
//            visiting.addAll(subsetStates);
//        }

        // TODO remove. Only for performance testing

        visiting.addAll(relevantStates);

        MdpGraph mdpGraph = model.getMdpGraph();
        long distance = 0;
        // Determine distance from Expression states (both ways)
        while(!visiting.isEmpty() && (ignoreMaxDistance() || distance <= maxDistance)){
            Set<Long> toVisit = new HashSet<>();

            for (Long stateID : visiting){
                Set<Long> reachingStates;

                // See all outgoing
                reachingStates = mdpGraph.incomingEdgesOf(stateID)
                        .stream()
                        .map(mdpGraph::getEdgeSource)
                        .filter(stateId -> relevantStates.contains(stateId))
                        .collect(Collectors.toSet());

                for (Long idReachingStates : reachingStates) {
                    if (!(visited.contains(idReachingStates) || visiting.contains(idReachingStates))){
                        toVisit.add(idReachingStates);
                    }
                }
            }

            visited.addAll(visiting);
            visiting = toVisit;
            distance++;
        }

        Set<Long> notReachable = new HashSet<>(model.getAllStates())
                .stream()
                .filter(stateId -> relevantStates.contains(stateId))
                .collect(Collectors.toSet());
        notReachable.removeAll(visited);

        for (long stateID : visited) {
            String reachingGroupingString = calcBinGroupingString(true, "reach","~reach");
            toExecute.add(String.format("UPDATE %s SET %s = '%s' WHERE %s = '%s'", model.getStateTableName(), getCollumn(), reachingGroupingString, ENTRY_S_ID, stateID));
        }

        for (long stateID : notReachable){
            String reachingGroupingString = calcBinGroupingString(false, "reach","~reach");
            toExecute.add(String.format("UPDATE %s SET %s = '%s' WHERE %s = '%s'", model.getStateTableName(), getCollumn(), reachingGroupingString, ENTRY_S_ID, stateID));
        }

        return toExecute;
    }

    @Override
    public String getCollumn() {
        return String.format("%s_%s", ViewType.ReachabilityView.name(), dbColumnId);
    }

    private boolean ignoreMaxDistance() {
        return maxDistance == -1;
    }

}


