package prism.db.mappers;

import org.jdbi.v3.core.mapper.RowMapper;
import org.jdbi.v3.core.statement.StatementContext;
import prism.Pair;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.ArrayList;
import java.util.List;

public class ArrayMapper<T, K> implements RowMapper<Pair<T, List<K>>> {

    String keyName;
    String valueName;

    Class<T> T;

    Class<K> K;


    public ArrayMapper(String keyName, String valueName, Class<T> T, Class<K> K){
        this.keyName = keyName;
        this.valueName = valueName;
        this.T = T;
        this.K = K;
    }

    @Override
    public Pair<T, List<K>> map(ResultSet rs, StatementContext ctx) throws SQLException {
        return new Pair<>(rs.getObject(keyName, T), List.of((K[]) rs.getArray(valueName).getArray()));
    }
}
