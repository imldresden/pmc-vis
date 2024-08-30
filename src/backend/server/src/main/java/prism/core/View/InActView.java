package prism.core.View;

import prism.core.Project;
import prism.core.mdpgraph.MdpGraph;
import prism.core.mdpgraph.MdpTransition;

import java.util.*;

/**
 * For a given action views all states with that outgoing action
 */

public class InActView extends View {


    private String action = null;

    enum CountModes {NONE, MIN, MAX, SPAN}

    CountModes countMode = CountModes.NONE;

    private int actionCountMin;

    private int actionCountMax;

    public InActView(Project parent, long id, Collection<String> attributeSetter) throws Exception {
        super(parent, ViewType.InActView, id);
        attributes.putAll(setAttributes(attributeSetter));
    }

    public InActView(Project parent, long id, String action){
        super(parent, ViewType.InActView, id);
        this.action = action;
        countMode = CountModes.NONE;
    }

    public InActView(Project parent, long id, String action, String min, String max){
        super(parent, ViewType.InActView, id);
        this.action = action;

        // set count modes and min max values
        countMode = CountModes.NONE;
        if (!min.equals("*")) {
            countMode = CountModes.MIN;
            this.actionCountMin = Integer.parseInt(min);
        }
        if (!max.equals("*")) {
            countMode = countMode.equals(CountModes.MIN) ? CountModes.SPAN : CountModes.MAX;
            this.actionCountMax = Integer.parseInt(max);
        }

    }

    @Override
    protected Map<String, Object> assignAttributes(String attName, String attValue) throws Exception {
        Map<String, Object> modifiedAttributes = new HashMap<>();
        attName = attName.toLowerCase();
        switch (attName) {
            case "min":
                if (!attValue.equals("*")) {
                    countMode = countMode == CountModes.MAX ? CountModes.SPAN : CountModes.MIN;
                    actionCountMin = Integer.parseInt(attValue);
                }
                modifiedAttributes.put(attName, countMode);
                break;
            case "max":
                if (!attValue.equals("*")) {
                    countMode = countMode == CountModes.MIN ? CountModes.SPAN : CountModes.MAX;
                    actionCountMax = Integer.parseInt(attValue);
                }
                modifiedAttributes.put(attName, countMode);
                break;
            case "action":
                action = attValue;
                modifiedAttributes.put(attName, action);
                break;
            default:
                throw new RuntimeException(attName);
        }

        return modifiedAttributes;
    }

    @Override
    protected List<String> groupingFunction() {
        List<String> toExecute = new ArrayList<>();

        MdpGraph mdpGraph = model.getMdpGraph();
        switch (countMode) {
            case NONE:
                for (Long stateId : relevantStates) {
                    String hasAction = mdpGraph.incomingEdgesOf(stateId).stream()
                            .map(mdpGraph::getTransObj)
                            .map(MdpTransition::getAction)
                            .filter(actionString -> actionString.equals(action))
                            .findAny()
                            .orElse("");
                    hasAction = semiGrouping && hasAction.isEmpty() ? ENTRY_C_BLANK : hasAction;
                    toExecute.add(String.format("UPDATE %s SET %s = '%s' WHERE %s = '%s'", model.getStateTableName(), getCollumn(), hasAction, ENTRY_S_ID, stateId));
                }
                break;
            default:
                for (Long stateId : relevantStates) {
                    // maybe could be implemented with higher performance using loops instead of functional programming
                    long actionCount = mdpGraph.incomingEdgesOf(stateId).stream()
                            .map(mdpGraph::getTransObj)
                            .map(MdpTransition::getAction)
                            .filter(actionString -> actionString.equals(action))
                            .count();
                    boolean hasAction = false; // only for compiler; switch case is exhaustive
                    switch (countMode) {
                        case MIN:
                            hasAction = actionCount >= actionCountMin;
                            break;
                        case MAX:
                            hasAction = actionCount <= actionCountMin;
                            break;
                        case SPAN:
                            hasAction = actionCount >= actionCountMin && actionCount <= actionCountMax;
                            break;
                    }
                    String actionGroupingString = calcBinGroupingString(hasAction, action, "~iAct");
                    toExecute.add(String.format("UPDATE %s SET %s = '%s' WHERE %s = '%s'", model.getStateTableName(), getCollumn(), actionGroupingString, ENTRY_S_ID, stateId));
                }
                break;
        }

        return toExecute;
    }

    @Override
    public String getCollumn() {
        return ViewType.InActView.name();
    }

}
