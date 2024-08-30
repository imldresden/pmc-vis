package prism.db.mappers;

import org.jdbi.v3.core.mapper.RowMapper;
import org.jdbi.v3.core.statement.StatementContext;
import prism.core.Namespace;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.stream.Collectors;

/**
 * Maps database outputs for views content. Needed since we need to map a string output to a List of longs
 */
public class ViewMapper implements RowMapper<List<Long>> {
    @Override
    public List<Long> map(ResultSet rs, StatementContext ctx) throws SQLException {
        try{
            String out = rs.getString(Namespace.ENTRY_C_SUB);
            if (out == null) return new ArrayList<>();
            return Arrays.stream(out.split(";")).map(Long::valueOf).collect(Collectors.toList());
        }catch(SQLException e){
            return new ArrayList<>();
        }
    }
}
