package prism.core.View;

import prism.api.State;
import prism.api.Transition;
import prism.core.Project;
import prism.core.mdpgraph.MdpGraph;
import prism.core.mdpgraph.MdpTransition;

import java.util.*;
import java.util.stream.Collectors;

/**
 * For a given action views all states with that outgoing action
 */

public class OutActView extends View {

    private String action;

    enum CountModes {NONE, MIN, MAX, SPAN}

    CountModes countMode = CountModes.NONE;

    private int actionCountMin;

    private int actionCountMax;

    public OutActView(Project parent, long id, Collection<String> attributeSetter) throws Exception {
        super(parent, ViewType.OutActView, id);
        attributes.putAll(setAttributes(attributeSetter));
    }

    public OutActView(Project parent, long id, String action){
        super(parent, ViewType.OutActView, id);
        this.action = action;
        countMode = CountModes.NONE;
    }

    public OutActView(Project parent, long id, String action, String min, String max){
        super(parent, ViewType.OutActView, id);
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
                    String hasAction = mdpGraph.outgoingEdgesOf(stateId).stream()
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
                    long actionCount = mdpGraph.outgoingEdgesOf(stateId).stream()
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

    @Deprecated
    protected List<String> groupingFunctionOLD() {
        List<String> toExecute = new ArrayList<>();

        Set<State> states = model.getStates(model.getAllStates())
                .stream()
                .filter(state -> relevantStates.contains(state.getNumId()))
                .collect(Collectors.toSet());

        // Create views by checking if state has action of interest
        // Variant with less code but less performance below
        for (State state : states) {
            int countAction = 0;
            boolean hasAction;

            switch (countMode) {
                case NONE:
                    hasAction = false;
                    for (Transition trans : model.getOutgoingList(state.getNumId())) {
                        if (trans.getAction().equals(this.action)) {
                            hasAction = true;
                            break;
                        }
                    }
                    break;
                case MIN:
                    hasAction = false;
                    for (Transition trans : model.getOutgoingList(state.getNumId())) {
                        if (trans.getAction().equals(this.action)) {
                            countAction++;
                            if (countAction >= this.actionCountMin) {
                                hasAction = true;
                                break;
                            }
                        }
                    }
                    break;
                case MAX:
                    hasAction = true;
                    for (Transition trans : model.getOutgoingList(state.getNumId())) {
                        if (trans.getAction().equals(this.action)) {
                            countAction++;
                            if (countAction > this.actionCountMax) {
                                hasAction = false;
                                break;
                            }
                        }
                    }
                    break;
                case SPAN: default:
                    // hasAction default: action; asserted to default string if exceeds max count
                    // check if min reached afterwards
                    hasAction = true;
                    for (Transition trans : model.getOutgoingList(state.getNumId())) {
                        if (trans.getAction().equals(this.action)) {
                            countAction++;
                            if (countAction > this.actionCountMax) {
                                hasAction = false;
                                break;
                            }
                        }
                    }
                    // maxRequirement && minRequirement
                    hasAction = hasAction && countAction >= this.actionCountMin;
                    break;
            }
            String actionGroupingString = calcBinGroupingString(hasAction, action, "~oAct");
            toExecute.add(String.format("UPDATE %s SET %s = '%s' WHERE %s = '%s'", model.getStateTableName(), getCollumn(), actionGroupingString, ENTRY_S_ID, state.getNumId()));

        }
//            switch (countMode) {
//                case NONE:
//                    for (State state : model.getStates(model.getAllStates())) {
//                        String hasAction = "";
//                        for (Transition trans : model.getOutgoingList(state.getNumId())) {
//                            if (trans.getAction().equals(this.action)) {
//                                hasAction = this.action;
//                                break;
//                            }
//                        }
//                        hasAction = semiGrouping && hasAction.isEmpty() ? ENTRY_C_BLANK : hasAction;
//                        toExecute.add(String.format("UPDATE %s SET %s = '%s' WHERE %s = '%s'", model.getStateTableName(), getCollumn(), hasAction, ENTRY_S_ID, state.getNumId()));
//                    }
//                    break;
//                case MIN:
//                    for (State state : model.getStates(model.getAllStates())) {
//                        int countAction = 0;
//                        String hasAction = "";
//                        for (Transition trans : model.getOutgoingList(state.getNumId())) {
//                            if (trans.getAction().equals(this.action)) {
//                                countAction++;
//                                if (countAction >= this.actionCountMin) {
//                                    hasAction = this.action;
//                                    break;
//                                }
//                            }
//                        }
//                        hasAction = semiGrouping && hasAction.isEmpty() ? ENTRY_C_BLANK: hasAction;
//                        toExecute.add(String.format("UPDATE %s SET %s = '%s' WHERE %s = '%s'", model.getStateTableName(), getCollumn(), hasAction, ENTRY_S_ID, state.getNumId()));
//                    }
//                    break;
//                case MAX:
//                    for (State state : model.getStates(model.getAllStates())) {
//                        int countAction = 0;
//                        String hasAction = this.action;
//                        for (Transition trans : model.getOutgoingList(state.getNumId())) {
//                            if (trans.getAction().equals(this.action)) {
//                                countAction++;
//                                if (countAction > this.actionCountMax) {
//                                    hasAction = ENTRY_C_BLANK;
//                                    break;
//                                }
//                            }
//                        }
//                        switch (binaryMode)
//                        hasAction = semiGrouping && hasAction.isEmpty() ? ENTRY_C_BLANK : hasAction;
//                        toExecute.add(String.format("UPDATE %s SET %s = '%s' WHERE %s = '%s'", model.getStateTableName(), getCollumn(), hasAction, ENTRY_S_ID, state.getNumId()));
//                    }
//                    break;
//                case SPAN:
//                    for (State state : model.getStates(model.getAllStates())) {
//                        int countAction = 0;
//
//                        // hasAction default: action; asserted to default string if exceeds max count
//                        // check if min reached afterwards
//                        String hasAction = action;
//                        boolean maxExceeded = false;
//                        for (Transition trans : model.getOutgoingList(state.getNumId())) {
//                            if (trans.getAction().equals(this.action)) {
//                                countAction++;
//                                if (countAction > this.actionCountMax) {
//                                    hasAction = "";
//                                    maxExceeded = true;
//                                    break;
//                                }
//                            }
//                        }
//                        if (!maxExceeded) {
//                            if (countAction >= this.actionCountMin) {
//                                hasAction = this.action;
//                            } else {
//                                hasAction = "";
//                            }
//                        }
//
//                        hasAction = semiGrouping && hasAction.isEmpty() ? ENTRY_C_BLANK : hasAction;
//                        toExecute.add(String.format("UPDATE %s SET %s = '%s' WHERE %s = '%s'", model.getStateTableName(), getCollumn(), hasAction, ENTRY_S_ID, state.getNumId()));
//                    }
//                    break;
//            }



//            VARIANT: all in one LOOP less performance less code: also mean variant between the above and below possible
//            for (State state : model.getStates(model.getAllStates())) {
//                int countAction = 0;
//                String hasAction = state.getId();
//                for (Transition trans : model.getOutgoingList(state.getNumId())) {
//                    if (trans.getAction().equals(this.action)) {
//                        countAction++;
//                        if (countMode.equals(CountModes.NONE) || (countMode.equals(CountModes.MIN) && countAction >= this.actionCountMin)) {
//                            hasAction = this.action;
//                            break;
//                        }
//                    }
//                }
//
//                if (countMode.equals(CountModes.MAX) && countAction <= this.actionCountMax) {
//                    hasAction = this.action;
//                } else if (countMode.equals(CountModes.SPAN) && countAction >= this.actionCountMin && countAction <= actionCountMax) {
//                    hasAction = this.action;
//                }
//
//                toExecute.add(String.format("UPDATE %s SET %s = '%s' WHERE %s = '%s'", model.getStateTableName(), getCollumn(), hasAction, ENTRY_S_ID, state.getNumId()));
//            }

        return toExecute;
    }

    @Override
    public String getCollumn() {
        return ViewType.OutActView.name();
    }

}
