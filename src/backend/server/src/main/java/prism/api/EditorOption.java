package prism.api;

import com.fasterxml.jackson.annotation.*;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.JsonMappingException;
import com.fasterxml.jackson.databind.ObjectMapper;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

@JsonInclude(JsonInclude.Include.NON_NULL)
public class EditorOption {
    @JsonAlias({"name", "title"})
    private String label;
    @JsonAlias({"args", "cli_args"})
    private String argument;

    private Map<String, List<EditorParameter>> parameters = new HashMap<>();

    public EditorOption() {
        // Jackson deserialization
    }

    public EditorOption(String label, String argument, Map<String, List<EditorParameter>> parameters) {
        this.label = label;
        this.argument = argument;
        this.parameters = new HashMap<>(parameters);
    }

    public EditorOption(String label, String argument) {
        this(label, argument, new HashMap<>());
    }

    @JsonAnySetter
    public void addParameter(String name, Object value) {
        try {
            ObjectMapper mapper = new ObjectMapper();
            List<EditorParameter> parameter = mapper.convertValue(value, new TypeReference<>() {
            });
            if (parameter != null) {
                this.parameters.put(name, parameter);
            }
        }catch(Exception e) {
            //System.out.println(value);
            //System.out.println(e.getMessage());
        }

    }

    @JsonProperty
    public String getLabel() {
        return label;
    }

    @JsonProperty
    public String getArgument() {
        return argument;
    }

    @JsonProperty
    public Map<String, List<EditorParameter>> getParameters() {
        return parameters;
    }
}
