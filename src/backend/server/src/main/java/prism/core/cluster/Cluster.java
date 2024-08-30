package prism.core.cluster;

import prism.core.Model;
import prism.core.Namespace;

/**
 * Class used as parent of all model abstractions implemented. Contains the definition for all utility functions
 *
 * Single Abstractions only need to define the buildModel() function, that describes how the abstraction exactly works.
 */
public abstract class Cluster implements Namespace {

    protected final ClusterType type;

    protected final Model model;

    protected final long id;


    public Cluster(Model parent, ClusterType type, long id) {
        this.type = type;
        this.model = parent;
        this.id = id;
    }

    public abstract void buildCluster();

    protected boolean isBuilt(){
        return model.getDatabase().question(String.format("SELECT * FROM pragma_table_info('%s') WHERE name='%s'\n", model.getStateTableName(), getCollumn()));
    }

    public ClusterType getType() {
        return type;
    }

    public long getId() {
        return this.id;
    }

    public abstract String getCollumn() ;
}
