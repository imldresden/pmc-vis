package prism.api;

import com.fasterxml.jackson.annotation.JsonProperty;

import java.util.List;
import java.util.Map;

public class Scheduler {

    public static class Variable{
        private final String name;
        private final int minValue;
        private final int maxValue;

        public Variable(String name, int minValue, int maxValue){
            this.name = name;
            this.minValue = minValue;
            this.maxValue = maxValue;
        }

        @JsonProperty
        public String getName() {
            return name;
        }

        @JsonProperty
        public int getMinValue() {
            return minValue;
        }

        @JsonProperty
        public int getMaxValue() {
            return maxValue;
        }
    }

    private final List<Variable> variables;
    private final List<String> actions;
    private final Map<String, List<String>> stateMap;

    public Scheduler(List<Variable> variables, List<String> actions, Map<String, List<String>> stateMap) {
        this.variables = variables;
        this.actions = actions;
        this.stateMap = stateMap;
    }

    @JsonProperty
    public List<Variable> getVariables() {
        return variables;
    }

    @JsonProperty
    public List<String> getActions() {
        return actions;
    }

    @JsonProperty
    public Map<String, List<String>> getStateMap() {
        return stateMap;
    }

}
