package prism.core.cluster;

import prism.api.Transition;
import prism.core.Model;

import java.util.*;

/**
 * Cluster that clusters all state by distance to a set of states specified by an expression.
 */
public class DistanceCluster extends Cluster {

    public enum DistanceDirection{FORWARD, BACKWARD, DIRECTIONLESS}

    private final String identifierExpression;

    private final long granularity;

    private final DistanceDirection direction;

    public DistanceCluster(Model parent, long id, String identifierExpression, long granularity, DistanceDirection direction) {
        super(parent, ClusterType.DistanceCluster, id);
        this.direction = direction;
        this.identifierExpression = identifierExpression;
        this.granularity = granularity;
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

            // 3. Compute reachability score
            Set<Long> visited = new HashSet<>();
            Set<Long> visiting = new HashSet<>();
            long distance = 0;

            //3.1. initialise states with expression
            if (identifierExpression.equals("init")){
                visiting.addAll(model.getInitialStates());
            }else{
                visiting.addAll(model.getStatesByExpression(identifierExpression));
            }

            //3.2. Determine distance from Expression states (both ways)
            while(!visiting.isEmpty()){
                Set<Long> toVisit = new HashSet<>();

                for (Long stateID : visiting){
                    long curr = distance - Math.floorMod(distance, granularity);
                    toExecute.add(String.format("UPDATE %s SET %s = '%s' WHERE %s = '%s'", model.getStateTableName(), getCollumn(), curr, ENTRY_S_ID, stateID));

                    //See all outgoing
                    List<Transition> outgoing = model.getOutgoingList(stateID);
                    for (Transition vert : outgoing){
                        for (String reachable : vert.getProbabilityDistribution().keySet()){
                            long r = Long.parseLong(reachable);
                            if (!(visited.contains(r) | visiting.contains(r))){
                                toVisit.add(r);
                            }
                        }
                    }
                }

                visited.addAll(visiting);
                visiting = toVisit;
                distance++;
            }

            Set<Long> not_reachable = new HashSet<>(model.getAllStates());
            not_reachable.removeAll(visited);

            for (long stateID : not_reachable){
                toExecute.add(String.format("UPDATE %s SET %s = '%s' WHERE %s = '%s'", model.getStateTableName(), getCollumn(), "inf", ENTRY_S_ID, stateID));
            }

            // 4. Write AP Labels to database
            model.getDatabase().executeBatch(toExecute);


        } catch(Exception e){
            e.printStackTrace();
            throw new RuntimeException(e);
        }
        System.out.println("\n\nFinished\n\n");
    }

    @Override
    public String getCollumn() {
        return String.format("%s_%s", ClusterType.DistanceCluster.name(), id);
    }

    public boolean match(String expression, long granularity) {
        return this.identifierExpression.equals(expression) & (this.granularity == granularity);
    }
}
