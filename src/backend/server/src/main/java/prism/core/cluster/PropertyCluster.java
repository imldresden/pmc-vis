package prism.core.cluster;


import prism.core.Model;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.*;


/**
 * Cluster that clusters the states by their value for a model checked property. Granularity is used to determine how close the property values can be.
 *
 * Example: granularity of 0.1 gathers all states with value 0.5 to 0.15 into a cluster called 0.1, 0.15 to 0.25 into 0.2 and so on. Edge cases like 0.25 are round up.
 */
public class PropertyCluster extends Cluster {

    private final String propertyName;

    BigDecimal granularity;

    public PropertyCluster(Model parent, long id, String propertyName, double granularity){
        super(parent, ClusterType.PropertyCluster, id);
        this.propertyName = propertyName;
        this.granularity = new BigDecimal(Double.toString(granularity));
    }

    @Override
    public void buildCluster() {

        if (!model.existsProperty(propertyName)){
            throw new RuntimeException(String.format("Property %s not found", propertyName));
        }

        List<String> toExecute = new ArrayList<>();

        try{
            // 1. Assure that there is no entry already. If there is, abort
            if (isBuilt()){
                return;
            }

            // 2. Create new Column
            model.getDatabase().execute(String.format("ALTER TABLE %s ADD COLUMN %s TEXT", model.getStateTableName(), getCollumn()));

            // 3. Create clusters by checking property Values
            for (Map.Entry<Long, Double> e : model.getPropertyMap(propertyName).entrySet()) {
                BigDecimal value = BigDecimal.valueOf(e.getValue()).divide(granularity, 0, RoundingMode.HALF_UP);
                BigDecimal comp = granularity.multiply(value);
                BigDecimal solution = comp.setScale(granularity.scale(), RoundingMode.HALF_UP);
                toExecute.add(String.format("UPDATE %s SET %s = '%s' WHERE %s = '%s'", model.getStateTableName(), getCollumn(), solution, ENTRY_S_ID, e.getKey()));
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
        return String.format("%s_%s", ClusterType.PropertyCluster.name(), id);
    }

    public boolean match(String propertyName, double granularity) {
        return this.propertyName.equals(propertyName) & (this.granularity == new BigDecimal(Double.toString(granularity)));
    }
}
