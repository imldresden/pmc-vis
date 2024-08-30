package prism.core.View;

import prism.core.Project;
import prism.core.mdpgraph.MdpGraph;
import prism.core.mdpgraph.MdpTransition;

import java.util.*;
import java.util.stream.Collectors;


/**
 * View that views all states with the same atomic propositions (or as prism calls them, labels) together.
 */
public class OutActSetSizeView extends View {

    Set<String> permittedActions = new HashSet<>();

    enum ViewModes {NONE, SINGLE, RESTRICTED_ACTION}

    ViewModes mode = ViewModes.NONE;

    public OutActSetSizeView(Project parent, long id, Collection<String> attributeSetter) throws Exception {
        super(parent, ViewType.OutActSetSizeView, id);
        attributes.put("permittedactions", permittedActions);
        attributes.put("mode", mode);
        attributes.putAll(setAttributes(attributeSetter));
    }

    public OutActSetSizeView(Project parent, long id, String viewMode, Collection<String> permittedActions){

        super(parent, ViewType.OutActSetSizeView, id);
        this.permittedActions = new HashSet<>(permittedActions);
        switch (viewMode) {
            case "single":
                mode = ViewModes.SINGLE;
                break;
            case "action":
                mode = ViewModes.RESTRICTED_ACTION;
                break;
            case "none": default:
                mode = ViewModes.NONE;
                break;
        }
        attributes.put("permittedactions", permittedActions);
        attributes.put("mode", mode);
    }

    @Override
    protected Map<String, Object> assignAttributes(String attName, String attValue) throws Exception {
        Map<String, Object> modifiedAttributes = new HashMap<>();
        attName = attName.toLowerCase();
        switch (attName) {
            case "permactions":
            case "permittedactions":
                if (attValue.equalsIgnoreCase("remove")) {
                    permittedActions = new HashSet<>();
                }
                else {
                    permittedActions.addAll(List.of(attValue.split(",")));
                }
                modifiedAttributes.put("permittedactions", permittedActions);
                break;
            case "mode":
                mode = ViewModes.valueOf(attValue);
                modifiedAttributes.put(attName, mode);
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

        for (Long stateId : relevantStates) {
            int outActSetSize = mdpGraph.outgoingEdgesOf(stateId)
                    .stream()
                    .map(mdpGraph::getTransObj)
                    .map(MdpTransition::getAction)
                    .filter(action -> !mode.equals(ViewModes.RESTRICTED_ACTION) || permittedActions.contains(action))
                    .collect(Collectors.toSet())
                    .size();

            String outActSetSizeString;
            if (mode.equals(ViewModes.SINGLE)) {
                outActSetSizeString = outActSetSize == 1 ? "SingleOutAct" : "";
                outActSetSizeString = semiGrouping && outActSetSizeString.isEmpty() ? ENTRY_C_BLANK : outActSetSizeString;
            }
            else {
                outActSetSizeString = Integer.toString(outActSetSize);
            }

            toExecute.add(String.format("UPDATE %s SET %s = '%s' WHERE %s = '%s'", model.getStateTableName(), getCollumn(), outActSetSizeString, ENTRY_S_ID, stateId));
        }

        return toExecute;
    }

    @Override
    public String getCollumn() {
        return ViewType.OutActSetSizeView.name();
    }

}
