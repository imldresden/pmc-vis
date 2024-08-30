package prism.db.mappers;

import org.jdbi.v3.core.mapper.RowMapper;
import org.jdbi.v3.core.statement.StatementContext;
import prism.core.Namespace;
import prism.core.Property.Property;

import java.sql.ResultSet;
import java.sql.ResultSetMetaData;
import java.sql.SQLException;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * Maps database output for property Maps (i.e. Maps from property name to value in state)
 */
public class ScheduleMapper implements RowMapper<Map<String, Double>> {

    private final List<Property> properties;

    public ScheduleMapper(List<Property> properties){
        this.properties = properties;
    }

    @Override
    public Map<String, Double> map(final ResultSet rs, final StatementContext ctx) throws SQLException {
        Map<String, Double> propertyMap = new HashMap<>();
        ResultSetMetaData rsm = rs.getMetaData();
        for (int i = 1; i <= rsm.getColumnCount();i++){
            String collumn = rsm.getColumnName(i);
            if (collumn.startsWith(Namespace.ENTRY_SCHED)){
                int l = Integer.parseInt(collumn.replace(Namespace.ENTRY_SCHED, ""));
                propertyMap.put(properties.get(l).getName(), rs.getDouble(collumn));
            }
        }
        return propertyMap;
    }
}
