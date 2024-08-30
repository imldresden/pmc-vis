package prism.db.mappers;

import org.jdbi.v3.core.mapper.RowMapper;
import org.jdbi.v3.core.statement.StatementContext;
import prism.core.Namespace;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.*;

/**
 * Maps database outputs for cluster content. Needed since we need to map a string output to a List of longs
 */
public class DistributionMapper implements RowMapper<Map<Long, Double>> {

    @Override
    public Map<Long, Double> map(ResultSet rs, StatementContext ctx) throws SQLException {
        String out = rs.getString(Namespace.ENTRY_T_PROB);
        Map<Long, Double> ret = new HashMap<>();
        if (out == null) return ret;
        for (String entry : out.split(";")){
            String[] e = entry.split(":");
            if (e.length != 2){
                throw new SQLException();
            }
            ret.put(Long.parseLong(e[0]), Double.parseDouble(e[1]));
        }
        return ret;
    }
}
