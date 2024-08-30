package prism.api;

import com.fasterxml.jackson.annotation.JsonIgnore;
import io.swagger.v3.oas.annotations.media.Schema;

import java.util.*;
import java.util.stream.Collectors;

@Schema(description="Object representing a single Node of a Graph")
public class State implements Node{

    private long id;

    private String name;

    private List<Long> clusteredNodes;

    private List<String> clusters;

    private TreeMap<String, Object> parameters;

    private TreeMap<String, Double> properties;

    private TreeMap<String, Double> rewards;

    private TreeMap<String, AP> atomicPropositions;

    public State(){
        // Jackson deserialization
    }

    public State(long id, String name, Map<String, Object> parameters, TreeMap<String, AP> atomicPropositions, Map<String, Double> rewards, Map<String, Double> properties) {
        this.id = id;
        this.name = name;
        this.parameters = new TreeMap<>(parameters);
        this.clusteredNodes = null;
        this.clusters = null;
        this.properties = new TreeMap<>(properties);
        this.rewards = new TreeMap<>(rewards);
        this.atomicPropositions = atomicPropositions;
    }

    public State(String name, List<String> clusters, List<Long> clusteredNodes) {
        this.id = -1;
        this.name = name;
        this.parameters = new TreeMap<>();
        this.clusteredNodes = clusteredNodes;
        this.clusters = clusters;
        this.properties = new TreeMap<>();
        this.rewards = new TreeMap<>();
    }

    @Override
    public String getId() {
        return (clusters == null) ? Long.toString(id): String.format("%s_%s", String.join("_", clusters), name);
    }

    @Override
    public String getName() {
        return name;
    }

    @Override
    public Map<String, Map<String, Value>> getDetails() {
        Map<String, Map<String, Value>> details = new HashMap<>();
        details.put(OUTPUT_VARIABLES, new TreeMap<>(parameters.entrySet().stream().collect(Collectors.toMap(e -> e.getKey(), e -> new Value(e.getValue(), "ordinal")))));
        details.put(OUTPUT_REWARDS, new TreeMap<>(rewards.entrySet().stream().collect(Collectors.toMap(e -> e.getKey(), e -> new Value(e.getValue(), "ordinal")))));
        details.put(OUTPUT_RESULTS, new TreeMap<>(properties.entrySet().stream().collect(Collectors.toMap(e -> e.getKey(), e -> new Value(e.getValue(), "ordinal")))));
        details.put(OUTPUT_LABELS, new TreeMap<>(atomicPropositions.entrySet().stream().collect(Collectors.toMap(e -> e.getKey(), e -> e.getValue() == null ? new Value() : new Value(e.getValue())))));
        return details;
    }

    @Override
    public String getType() {
        return "s";
    }

    @Override
    public Map<String, Object> getViewDetails() {
        Map<String, Object> output = new HashMap<>();
        output.put("cluster identifier", clusters);
        if (clusters != null){
            output.put("clustered states", clusteredNodes);
            output.put("number of clustered states", clusteredNodes.size());
        }
        return output;
    }

    @Override
    public long getNumId() {
        return id;
    }

    @Override
    public double getReward(String name) {
        if (!rewards.containsKey(name)){
            double value = 0.0;
            for (double reward : rewards.values()){
                value += reward;
            }
            return value;
        }
        return rewards.get(name);
    }

    @JsonIgnore
    public String getParameterString() {
        List<String> buffer = new ArrayList<>();
        for (Map.Entry<String, Object> e: parameters.entrySet()){
            buffer.add(String.format("%s=%s", e.getKey(), e.getValue()));
        }
        return String.join(";", buffer);
    }
}
