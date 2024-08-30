package prism.api;

import com.fasterxml.jackson.annotation.JsonProperty;
import io.swagger.v3.oas.annotations.media.Schema;

@Schema(description="Object representing a single Vertice of a Graph")
public class Edge {

    private String source;

    private String target;

    private String label;

    public Edge(){
        // Jackson deserialization
    }

    public Edge(String source, String target, String label){
        this.source = source;
        this.target = target;
        this.label = label;
    }

    @Schema(description = "Origin node of edge")
    @JsonProperty
    public String getSource() {
        return source;
    }

    @Schema(description = "Target node of edge")
    @JsonProperty
    public String getTarget() {
        return target;
    }

    @Schema(description = "Label edge should show")
    @JsonProperty
    public String getLabel() {
        return label;
    }
}
