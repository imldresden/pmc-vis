package prism.db.mappers;

import prism.StateAndValueConsumer;

import java.util.Arrays;
import java.util.HashMap;
import java.util.Map;
import java.util.stream.Collectors;

public class StateAndValueMapper implements StateAndValueConsumer {

    private final Map<Long, Double> valueMap;

    public StateAndValueMapper(){
        this.valueMap = new HashMap<>();
    }

    @Override
    public void accept(int[] varValues, double value, long stateIndex) {
        if (stateIndex == -1){
            System.out.println("Illegal Access to " + Arrays.stream(varValues).mapToObj(String::valueOf).collect(Collectors.joining(";")));
        }else{
            valueMap.put(stateIndex, value);
        }
    }

    public Map<Long, Double> output(){
        return valueMap;
    }
}
