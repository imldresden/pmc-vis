package prism.api;

import com.fasterxml.jackson.annotation.JsonProperty;
import io.swagger.v3.oas.annotations.media.Schema;

@Schema(description="Simple Message returned with a response")
public class Message {
    private String content;

    public Message(String content){
        this.content = content;
    }

    @Schema(description = "content of the Message")
    @JsonProperty
    public String getContent() { return content; }
}
