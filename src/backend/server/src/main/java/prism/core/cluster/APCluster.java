package prism.core.cluster;

import prism.api.State;
import prism.core.Model;

import java.util.*;


/**
 * Cluster that clusters all states with the same atomic propositions (or as prism calls them, labels) together.
 */
public class APCluster extends Cluster {

    public APCluster(Model parent, long id){
        super(parent, ClusterType.APCluster, id);
    }

    @Override
    public void buildCluster() {
        List<String> toExecute = new ArrayList<>();

        try{
            // 1. Assure that there is no entry already. If there is, abort
            if (isBuilt()){
                return;
            }

            // 2. Create new Collumn
            model.getDatabase().execute(String.format("ALTER TABLE %s ADD COLUMN %s TEXT", model.getStateTableName(), getCollumn()));

            // 3. Create clusters by checking AP Labels
            for (State state : model.getStates(model.getAllStates())) {
                String combination = String.join(";", model.getLabels(model.parseState(state.getParameterString())));
                toExecute.add(String.format("UPDATE %s SET %s = '%s' WHERE %s = '%s'", model.getStateTableName(), getCollumn(), combination, ENTRY_S_ID, state.getNumId()));
            }

            // 4. Write AP Labels to database
            model.getDatabase().executeBatch(toExecute);


        } catch(Exception e){
            throw new RuntimeException(e);
        }
        System.out.println("\n\nFinished\n\n");
    }

    @Override
    public String getCollumn() {
        return ClusterType.APCluster.name();
    }

}
