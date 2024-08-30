package prism.api;

import com.fasterxml.jackson.annotation.JsonIgnore;
import com.fasterxml.jackson.annotation.JsonProperty;
import io.swagger.v3.oas.annotations.media.Schema;

import java.util.*;
import java.util.stream.Collectors;

public class Transition implements Node{

    private long id;
    private String source;

    private String action;

    private Map<String, Double> probabilityDistribution;

    private TreeMap<String, Double> results;

    private TreeMap<String, Double> rewards;

    private TreeMap<String, Double> scheduler;

    private List<String> clusters;

    public Transition(){
        // Jackson deserialization
    }

    public Transition(long id, String source, String action, Map<Long, Double> probabilityDistribution, Map<String, Double> rewards, Map<String, Double> results, Map<String, Double> scheduler, List<String> clusters,  Map<Long, String> translation){
        this.id = id;
        this.source = source;
        this.action = action;
        this.clusters = clusters;
        this.results = new TreeMap<>(results);
        this.rewards = new TreeMap<>(rewards);
        this.scheduler = new TreeMap<>(scheduler);
        if (translation == null) {
            this.probabilityDistribution = probabilityDistribution.entrySet().stream().collect(Collectors.toMap(e -> Long.toString(e.getKey()), Map.Entry::getValue ));
        }
        else{
            Map<String, Double> translated = new HashMap<>();
            Double d = 0.0;
            for (Map.Entry<Long, Double> e : probabilityDistribution.entrySet()) {
                translated.put(translation.get(e.getKey()), e.getValue());
                d += e.getValue();
            }
            this.probabilityDistribution = new HashMap<>(translated);
            if (d>1.0){
                for (String state : translated.keySet()){
                    this.probabilityDistribution.replace(state, translated.get(state)/d);
                }
            }
        }
    }

    @Override
    public String getId() {
        return (clusters == null) ? String.format("t%s", id) : String.format("t%s_%s", String.join("_", clusters), id);
    }

    @Override
    public String getType() {
        return "t";
    }


    @Override
    public String getName() {
        return null;
    }

    @Override
    public Map<String, Map<String, Value>> getDetails() {
        Map<String, Map<String, Value>> details = new HashMap<>();
        Map<String, Value> parameters = new TreeMap<>();
        parameters.put("origin", new Value(source, "ordinal"));
        parameters.put("action", new Value(action, "ordinal"));
        parameters.put("outcome distribution", new Value(probabilityDistribution, "ordinal"));

        details.put(OUTPUT_VARIABLES, parameters);
        details.put(OUTPUT_REWARDS, new TreeMap<>(rewards.entrySet().stream().collect(Collectors.toMap(e -> e.getKey(), e -> new Value(e.getValue(), "ordinal")))));
        details.put(OUTPUT_RESULTS, new TreeMap<>(results.entrySet().stream().collect(Collectors.toMap(e -> e.getKey(), e -> new Value(e.getValue(), "ordinal")))));
        return details;
    }

    @Override
    public Map<String, Object> getViewDetails() {
        Map<String, Object> output = new HashMap<>();
        output.put("cluster identifier", clusters);
        return output;
    }

    @Override
    public long getNumId() {
        return id;
    }

    @Schema(description = "Does the scheduler for this property use this transition")
    @JsonProperty
    public Map<String, Double> getScheduler(){
        return scheduler;
    }

    @JsonIgnore
    public String getSource() {
        return source;
    }

    @JsonIgnore
    public String getAction() {
        return action;
    }

    @JsonIgnore
    public Map<String, Double> getProbabilityDistribution() {
        return probabilityDistribution;
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
    public List<Edge> createEdges(){
        List<Edge> edges = new ArrayList<>();
        edges.add(new Edge(source, this.getId(), action));
        for (Map.Entry<String, Double> e : probabilityDistribution.entrySet()) {
            edges.add(new Edge(this.getId(), e.getKey(), Double.toString(e.getValue())));
        }
        return edges;
    }
}
