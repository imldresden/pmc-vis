package prism.api;

import com.fasterxml.jackson.annotation.JsonProperty;
import io.swagger.v3.oas.annotations.media.Schema;

public class AP {

    private String identifier;

    private boolean icon;

    public AP(){
        // Jackson deserialization
    }

    public AP(String identifier, boolean icon){
        this.identifier = identifier;
        this.icon = icon;
    }

    @Schema(description = "Identifier used (either URL if icon true, otherwise Name)")
    @JsonProperty
    public String getIdentifier() {
        return identifier;
    }

    @Schema(description = "Does this AP have an icon?")
    @JsonProperty
    public boolean isIcon() {
        return icon;
    }


}
