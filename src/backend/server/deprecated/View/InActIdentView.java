package prism.core.View;

import prism.core.Project;
import prism.core.mdpgraph.MdpGraph;
import prism.core.mdpgraph.MdpTransition;

import java.util.*;
import java.util.stream.Collectors;

public class InActIdentView extends View {

    enum ViewModes {STRONG, WEAK}

    ViewModes viewMode = ViewModes.WEAK;

    public InActIdentView(Project parent, long id, Collection<String> attributeSetter) throws Exception {
        super(parent, ViewType.InActIdentView, id);
        attributes.putAll(setAttributes(attributeSetter));
    }

    public InActIdentView(Project parent, long id, String viewMode) {
        super(parent, ViewType.InActIdentView, id);
        this.viewMode = viewMode.equals("strong") ? ViewModes.STRONG : ViewModes.WEAK;
    }

    @Override
    protected Map<String, Object> assignAttributes(String attName, String attValue) throws Exception {
        Map<String, Object> modifiedAttributes = new HashMap<>();
        attName = attName.toLowerCase();
        switch (attName) {
            case "viewmode":
                viewMode = ViewModes.valueOf(attValue.toUpperCase());
                attributes.put(attName, viewMode);
                break;
            default:
                throw new Exception(attName);
        }
        return modifiedAttributes;
    }

    @Override
    protected List<String> groupingFunction() {
        List<String> toExecute = new ArrayList<>();

        // Create views by checking AP Labels
        // WEAK identity requires that the set of actions must be identical - THE QUANTITY OF AN ACTION DOES NOT MATTER
        MdpGraph mdpGraph = model.getMdpGraph();

        switch (viewMode) {
            case WEAK:
                // use sorted set
                // quantity of the actions doesnt matter
                for (Long stateId : relevantStates) {
                    SortedSet<String> actions = mdpGraph.incomingEdgesOf(stateId).stream()
                            .map(mdpGraph::getTransObj)
                            .map(MdpTransition::getAction)
                            .collect(Collectors.toCollection(TreeSet::new));
                    String actionString = semiGrouping && actions.isEmpty() ? ENTRY_C_BLANK : actions.toString();
                    toExecute.add(String.format("UPDATE %s SET %s = '%s' WHERE %s = '%s'", model.getStateTableName(), getCollumn(), actionString, ENTRY_S_ID, stateId));
                }
                break;
            case STRONG:
                // use sorted list
                // quantity of actions does matter
                for (Long stateId : relevantStates) {
                    List<String> actions = mdpGraph.incomingEdgesOf(stateId).stream()
                            .map(mdpGraph::getTransObj)
                            .map(MdpTransition::getAction)
                            .sorted()
                            .collect(Collectors.toList());
                    String actionString = semiGrouping && actions.isEmpty() ? ENTRY_C_BLANK : actions.toString();
                    toExecute.add(String.format("UPDATE %s SET %s = '%s' WHERE %s = '%s'", model.getStateTableName(), getCollumn(), actionString, ENTRY_S_ID, stateId));
                }
                break;
        }

        return toExecute;
    }

    @Override
    public String getCollumn() {
        return ViewType.InActIdentView.name();
    }
}
