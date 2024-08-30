package prism.core.View;

import prism.core.Project;
import prism.core.mdpgraph.MdpGraph;

import java.util.*;

public class VariablesViewDnf extends View {

    private List<Map<String,String>> requiredParams = new ArrayList<>();


    public VariablesViewDnf(Project parent, long id, Collection<String> attributeSetter) throws Exception {
        super(parent, ViewType.VariablesViewDnf, id);
        attributes.put("requiredvars", requiredParams);
        attributes.putAll(setAttributes(attributeSetter));
    }

    public VariablesViewDnf(Project parent, long id, List<Map<String,String>> requiredParams) {
        super(parent, ViewType.VariablesViewDnf, id);
        this.requiredParams = requiredParams;
        attributes.put("requiredvars", requiredParams);
    }

    @Override
    protected Map<String, Object> assignAttributes(String attName, String attValue) throws Exception {
        Map<String, Object> modifiedAttributes = new HashMap<>();
        attName = attName.toLowerCase();
        switch (attName) {
            case "reqvars":
            case "requiredvars": // requiredvars=x=1,y=!2z=b
                if (attValue.equalsIgnoreCase("remove")) {
                    requiredParams = new ArrayList<>();
                    modifiedAttributes.put("requiredvars", requiredParams);
                    break;
                }
                String[] monomStrings = attValue.split("OR"); // unsupported Operation exception causes "crash" (Stacktrace in Browser)
                for (String monomString : monomStrings) {           // when AND used -- something with immutable collection
                    Map<String, String> monom = new HashMap<>();
                    requiredParams.add(monom);
                    String[] literals = monomString.split(",");
                    for (String literal : literals) {
                        String[] literal_content = literal.split("=");
                        String paramName = literal_content[0];
                        String paramValue = literal_content[1];
                        if (literal_content.length != 2) {
                            throw new RuntimeException("Each literal has to be of the from <paramName>=[!]<paramValue>");
                        }
                        monom.put(paramName, paramValue);
                    }

                }
                modifiedAttributes.put("requiredvars", requiredParams);
                break;
            default:
                throw new RuntimeException(attName);
        }
        return modifiedAttributes;
    }

    @Override
    protected List<String> groupingFunction() {
        List<String> toExecute = new ArrayList<>();

        if (requiredParams.isEmpty()) {
            throw new RuntimeException("Required Params is empty! Can not build view!");
        }

        MdpGraph mdpGraph = model.getMdpGraph();

        for (Long stateId : relevantStates) {
            boolean paramValuesAsRequired = requiredParams.stream()
                    // a monom of the cnf is represented by a map {paramKey1 = paramVal1 AND paramKey2 = !paramVal2 AND ...}
                    .anyMatch(monom -> monom.keySet().stream()
                            .allMatch(paramKey -> {
                                String stateParamVal = mdpGraph.getStateObj(stateId).getVariable().get(paramKey).toString();
                                String reqParamVal = monom.get(paramKey);
                                if (reqParamVal.charAt(0) == '!') {
                                    reqParamVal = reqParamVal.substring(1);
                                    return !stateParamVal.equals(reqParamVal);
                                }
                                else {
                                    return stateParamVal.equals(reqParamVal);
                                }
                            })
                            );

//          String vars = paramValuesAsRequired ? requiredParams.stream().map(clause -> clause.entrySet().stream().map(Object::toString).collect(Collectors.joining("&&", "(", ")" ))).map(Object::toString).collect(Collectors.joining(" || ")) : noMatchString;
            String vars = requiredParams.toString();
            String paramGroupingString = calcBinGroupingString(paramValuesAsRequired, vars,"~Var");
            toExecute.add(String.format("UPDATE %s SET %s = '%s' WHERE %s = '%s'", model.getStateTableName(), getCollumn(), paramGroupingString, ENTRY_S_ID, stateId));
        }

        return toExecute;
    }

    @Override
    public String getCollumn() {
        return ViewType.VariablesViewDnf.name();
    }
}
