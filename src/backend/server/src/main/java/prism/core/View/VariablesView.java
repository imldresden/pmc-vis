package prism.core.View;

import prism.core.Project;

import java.util.*;

public class VariablesView extends View {

    private Map<String,String> requiredParams = new HashMap<>();

    private boolean considerParamValues = false;

    public VariablesView(Project parent, long id, Collection<String> parameterSetter) throws Exception {
        super(parent, ViewType.VariablesView, id);
        attributes.put("considerparamvalues", considerParamValues);
        attributes.put("requiredvars", requiredParams);
        attributes.putAll(setAttributes(parameterSetter));
    }

    public VariablesView(Project parent, long id, Map<String,String> requiredParams, boolean considerParamValues, boolean semiGrouping) {
        super(parent, ViewType.VariablesView, id);
        this.requiredParams = requiredParams;
        this.considerParamValues = considerParamValues;
        this.semiGrouping = semiGrouping;
    }
//    INITIALIZE ON ALL IN MAIN
//    String var = mdpGraphLean.getStateObj(mdpGraphLean.stateSet().iterator().next()).getVariable().keySet().iterator().next();
//    createView(ViewType.VariablesView, List.of("reqvars=" + param));

    @Override
    protected Map<String, Object> assignAttributes(String attName, String attValue) throws Exception {
        Map<String, Object> modifiedAttributes = new HashMap<>();
        attName = attName.toLowerCase();
        switch (attName) {
            case "reqvars":
            case "requiredvars": // requiredvars=x=1,y=2,z=b  --> requiredPrams.put("x", "1") ...
                if (attValue.equalsIgnoreCase("remove")) {
                    requiredParams = new HashMap<>();
                    modifiedAttributes.put("requiredvars", requiredParams);
                    break;
                }
                String[] reqParamsArray = attValue.split(",");
                for (String requirement : reqParamsArray) {
                    String[] reArray = requirement.split("=");

                    if (reArray.length == 0) {
                        throw new RuntimeException("Variable assignment is not of length 1 or 2, but 0");
                    }

                    String varName = reArray[0];

//                    System.out.println("####################AssignVariables");
//                    System.out.println(varName);

                    // check var available
                    List<String> availableVarNames = model.getModulesFile().getVarNames();
//                    System.out.println(!availableVarNames.contains(varName));
                    if (!availableVarNames.contains(varName)) {
                        throw new RuntimeException(varName + " is not a variable in this Project! " +
                                "Available variables are: " + String.join(", ", availableVarNames));
                    }

                    switch (reArray.length) {
                        case 1:
                            requiredParams.put(varName, "Only Variable specified!");
                            break;
                        case 2:
                            String varValue = reArray[1];
                            requiredParams.put(varName, varValue);
                            break;
                        default:
                            throw new RuntimeException("Variable assignment is not of length 1 or 2, but greater 2");
                    }
                }
                modifiedAttributes.put("requiredvars", requiredParams);
                break;
            case "considerparamvalues":
                considerParamValues = myParseBoolean(attValue);
                modifiedAttributes.put(attName, considerParamValues);
                break;
            default:
                throw new RuntimeException(attName);
        }

        return modifiedAttributes;

    }

    @Override
    protected List<String> groupingFunction() {
        List<String> toExecute = new ArrayList<>();

        // Create views by checking if every state has the vars with the relevant values
        if (requiredParams.keySet().isEmpty()) {
            throw new RuntimeException("Required Params is empty! Can not build view!");
        }

        if (considerParamValues) {
            for (Long stateId : relevantStates) { // requiredParams example: {x=!5, y=a}

                // Issue: parameter values are Strings -> Casting dificult -> using String representation currently
                Map <String,Object> stateParams = model.getMdpGraph().getStateObj(stateId).getVariable();
                boolean paramValuesAsRequired = true;
                for (String reqParamName : requiredParams.keySet()) {
                    String reqParamValue = requiredParams.get(reqParamName);
                    if (reqParamValue.charAt(0) == '!') {
                        reqParamValue = reqParamValue.substring(1);
                        paramValuesAsRequired = !(stateParams.containsKey(reqParamName) && reqParamValue.equals(stateParams.get(reqParamName).toString()));
                    }
                    else {
                        paramValuesAsRequired = stateParams.containsKey(reqParamName) && reqParamValue.equals(stateParams.get(reqParamName).toString());
                    }
                    if (!paramValuesAsRequired) {
                        break;
                    }
                }
                String vars = requiredParams.entrySet().toString();
                String paramGroupingString = calcBinGroupingString(paramValuesAsRequired, vars, "~Var");
                toExecute.add(String.format("UPDATE %s SET %s = '%s' WHERE %s = '%s'", model.getStateTableName(), getCollumn(), paramGroupingString, ENTRY_S_ID, stateId));
            }
        }

        else {
            for (Long stateId : relevantStates) {
                Map<String,Object> stateParams = model.getMdpGraph().getStateObj(stateId).getVariable();
                SortedSet<String> paramSet = new TreeSet<>();

                // create string of set of key value pairs but only for keys contained in requiredParams
                for (String key : requiredParams.keySet()) {

                    // in case paramValue of state not defined: assigned to null
                    Object stateParamValue = stateParams.get(key);

                    if (stateParamValue == null) {
                        throw new RuntimeException("Aborted! stateParams.get(" + key + ") returned null \n Available parameters are: " + stateParams.keySet());
                    }

                    // key included in string for appropriate sorting in set
                    paramSet.add(key + "=" + stateParamValue.toString());
                }
                String vars = paramSet.toString();
                toExecute.add(String.format("UPDATE %s SET %s = '%s' WHERE %s = '%s'", model.getStateTableName(), getCollumn(), vars, ENTRY_S_ID, stateId));
            }
        }

        return toExecute;
    }

    @Override
    public String getCollumn() {
        return ViewType.VariablesView.name();
    }
}
