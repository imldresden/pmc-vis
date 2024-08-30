package prism.db.mappers;

import org.jdbi.v3.core.mapper.RowMapper;
import org.jdbi.v3.core.statement.StatementContext;
import prism.core.Scheduler.Scheduler;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * Maps database output for property Maps (i.e. Maps from property name to value in state)
 */
public class ScheduleMapper implements RowMapper<Map<String, Double>> {

    private final List<Scheduler> schedulers;

    public ScheduleMapper(List<Scheduler> schedulers){
        this.schedulers = schedulers;
    }

    @Override
    public Map<String, Double> map(final ResultSet rs, final StatementContext ctx) throws SQLException {
        Map<String, Double> schedulerMap = new HashMap<>();
        for (Scheduler s : schedulers){
            schedulerMap.put(s.getName(), rs.getDouble(s.getCollumnName()));
        }
        return schedulerMap;
    }
}
