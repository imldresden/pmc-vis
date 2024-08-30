package prism.api;

import com.fasterxml.jackson.annotation.JsonProperty;
import io.swagger.v3.oas.annotations.media.Schema;
import prism.core.Project;
import prism.core.Scheduler.Scheduler;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.TreeMap;
import java.util.stream.Collectors;

@Schema(description="Object representing an entire Graph")
public class Graph {
    private List<Node> nodes;

    private List<Edge> edges;

    private TreeMap<String, Object> info;

    private List<String> scheduler;

    public Graph(){
        // Jackson deserialization
    }

    public Graph(Project project, List<State> states, List<Transition> transitions) {
        this.info = project.getInformation();
        this.nodes = new ArrayList<>(states);
        this.nodes.addAll(transitions);
        this.edges = new ArrayList<>();
        for (Transition t : transitions){
            edges.addAll(t.createEdges());
        }
        this.scheduler = project.getSchedulers().stream().map(Scheduler::getName).collect(Collectors.toList());
    }

    @Schema(description = "all nodes in the graph")
    @JsonProperty
    public List<Node> getNodes() {
        return nodes;
    }

    @Schema(description = "all edges in the graph")
    @JsonProperty
    public List<Edge> getEdges() {
        return edges;
    }

    @Schema(description = "Information about the MC process")
    @JsonProperty
    public Map<String, Object> getInfo() {
        return info;
    }

    @Schema(description = "Information about the known Schedulers (should move into info, but does not work on frontend otherwise)")
    @JsonProperty
    public List<String> getScheduler() {
        return scheduler;
    }
}