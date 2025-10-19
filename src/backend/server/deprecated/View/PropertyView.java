package prism.core.View;


import prism.core.Project;
import prism.core.Property.Property;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.*;


/**
 * View that views the states by their value for a model checked property. Granularity is used to determine how close the property values can be.
 *
 * Example: granularity of 0.1 gathers all states with value 0.5 to 0.15 into a views called 0.1, 0.15 to 0.25 into 0.2 and so on. Edge cases like 0.25 are round up.
 */
public class PropertyView extends View {

    private String propertyName;

    BigDecimal granularity = BigDecimal.valueOf(0.1);

    public PropertyView(Project parent, long id, Collection<String> attributeSetter) throws Exception {
        super(parent, ViewType.PropertyView, id);
        if (attributeSetter.stream().noneMatch(assigment -> assigment.contains("propertyname")))
            throw new RuntimeException("You need to provide a propertyname");
        attributes.putAll(setAttributes(attributeSetter));
    }

    public PropertyView(Project parent, long id, String propertyName, double granularity){
        super(parent, ViewType.PropertyView, id, true);
        this.propertyName = propertyName;
        this.granularity = new BigDecimal(Double.toString(granularity));
        attributes.put("propertyame", propertyName);
        attributes.put("granularity", this.granularity);
    }

    public PropertyView(Project parent, long id, String propertyName, double granularity, Collection<String> attributeSetter) throws Exception {
        super(parent, ViewType.PropertyView, id, attributeSetter);
        this.propertyName = propertyName;
        this.granularity = new BigDecimal(Double.toString(granularity));
        attributes.put("propertyame", propertyName);
        attributes.put("granularity", this.granularity);

    }

    @Override
    protected Map<String, Object> assignAttributes(String attName, String attValue) throws Exception {
        Map<String, Object> modifiedAttributes = new HashMap<>();
        attName = attName.toLowerCase();
        switch (attName) {
            case "propertyname":
                propertyName = attValue;
                modifiedAttributes.put(attName, propertyName);
                break;
            case "granularity":
                granularity = new BigDecimal(attValue);
                modifiedAttributes.put(attName, granularity);
                break;
            default:
                throw new RuntimeException(attName);
        }

        return modifiedAttributes;
    }

    @Override
    protected List<String> groupingFunction() {
        List<String> toExecute = new ArrayList<>();
        Optional<Property> property = model.getProperty(propertyName);

        // check requested by IDE for property.get() is done in viewRequirementsFulfilled,
        // which is called before the grouping function

        for (Map.Entry<Long, Double> e : property.get().getPropertyMap().entrySet() ){
            BigDecimal value = BigDecimal.valueOf(e.getValue()).divide(granularity, 0, RoundingMode.HALF_UP);
            BigDecimal comp = granularity.multiply(value);
            BigDecimal solution = comp.setScale(granularity.scale(), RoundingMode.HALF_UP);
            toExecute.add(String.format("UPDATE %s SET %s = '%s' WHERE %s = '%s'", model.getStateTableName(), getCollumn(), solution, ENTRY_S_ID, e.getKey()));
        }

        return toExecute;
    }

    @Override
    public String getCollumn() {
        return String.format("%s_%s", ViewType.PropertyView.name(), dbColumnId);
    }

    public boolean match(String propertyName, double granularity) {
        return this.propertyName.equals(propertyName) & (this.granularity == new BigDecimal(Double.toString(granularity)));
    }

    @Override
    protected boolean viewRequirementsFulfilled() {
        Optional<Property> property = model.getProperty(propertyName);

        if (property.isEmpty()){
            throw new RuntimeException(String.format("Property %s not found", propertyName));
        }
        System.out.println(!isBuilt());
        return !isBuilt();
    }
}
