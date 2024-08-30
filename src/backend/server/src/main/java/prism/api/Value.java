package prism.api;

import com.fasterxml.jackson.annotation.JsonAnyGetter;
import com.fasterxml.jackson.annotation.JsonProperty;
import io.swagger.v3.oas.annotations.media.Schema;

import java.util.HashMap;
import java.util.Map;
import java.util.TreeMap;

public class Value {
    private Object value;

    private Map<String,Object> info;

    public Value(){
        this.value = false;
        this.info = new HashMap<>();
        this.info.put("type", "boolean");
    }
    public Value (AP value){
        this.value = true;
        this.info = new TreeMap<>();
        this.info.put("type", "boolean");
        this.info.put("icon", value.isIcon());
        this.info.put("identifier", value.getIdentifier());
    }

    public Value(Object value, String type){
        this.value = value;
        this.info = new TreeMap<>();
        this.info.put("type", type);
    }

    @Schema(description = "Value of interest")
    @JsonProperty
    public Object getValue() {
        return value;
    }

    @Schema(description = "Other Information")
    @JsonAnyGetter
    public Map<String, Object> getInfo() {
        return info;
    }

}
