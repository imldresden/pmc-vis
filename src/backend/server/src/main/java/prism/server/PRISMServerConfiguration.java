package prism.server;

import com.fasterxml.jackson.annotation.JsonProperty;
import io.dropwizard.Configuration;
import io.dropwizard.db.DataSourceFactory;

import javax.validation.Valid;
import javax.validation.constraints.NotNull;

import static java.lang.Runtime.getRuntime;

public class PRISMServerConfiguration extends Configuration {

    private String pathTemplate;

    private boolean debug = false;

    private long memory = Math.round(getRuntime().maxMemory() / (1024 * 1024));

    private int iterations = 50000;

    private String initModel = "0";

    @Valid
    @NotNull
    private DataSourceFactory database = new DataSourceFactory();

    @JsonProperty
    public String getPathTemplate() {
        return pathTemplate;
    }

    @JsonProperty
    public void setPathTemplate(String pathTemplate) {
        this.pathTemplate = pathTemplate;
    }

    @JsonProperty
    public long getCUDDMaxMem() {
        return memory;
    }

    @JsonProperty
    public void setCUDDMaxMem(long memory) {
        this.memory = memory;
    }

    @JsonProperty
    public int getIterations() {
        return iterations;
    }

    @JsonProperty
    public void setIterations(int iterations) {
        this.iterations = iterations;
    }

    @JsonProperty
    public String getInitModel() {
        return initModel;
    }

    @JsonProperty
    public void setInitModel(String initModel) {
        this.initModel = initModel;
    }

    @JsonProperty
    public boolean getDebug() {
        return debug;
    }

    @JsonProperty
    public void setDebug(boolean debug) {
        this.debug = debug;
    }

    @JsonProperty("database")
    public void setDataSourceFactory(DataSourceFactory factory) {
        this.database = factory;
    }

    @JsonProperty("database")
    public DataSourceFactory getDataSourceFactory() {
        return database;
    }

}
