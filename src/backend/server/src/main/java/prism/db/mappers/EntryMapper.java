package prism.db.mappers;

import org.jdbi.v3.core.mapper.RowMapper;
import org.jdbi.v3.core.statement.StatementContext;
import prism.Pair;
import prism.core.Namespace;

import java.sql.ResultSet;
import java.sql.SQLException;

public class EntryMapper implements RowMapper<Pair<Long, Double>> {

    private final String propertyName;

    public EntryMapper(String propertyName){

        this.propertyName = propertyName;
    }

    @Override
    public Pair<Long, Double> map(ResultSet rs, StatementContext ctx) throws SQLException {
        return new Pair<>(rs.getLong(Namespace.ENTRY_S_ID), rs.getDouble(propertyName));
    }
}
