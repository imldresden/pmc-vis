package prism.db.mappers;

import org.jdbi.v3.core.mapper.RowMapper;
import org.jdbi.v3.core.statement.StatementContext;
import prism.Pair;

import java.sql.ResultSet;
import java.sql.SQLException;

public class PairMapper<T, K> implements RowMapper<Pair<T, K>> {

    String keyName;
    String valueName;

    Class<T> T;

    Class<K> K;


    public PairMapper(String keyName, String valueName, Class<T> T, Class<K> K){
        this.keyName = keyName;
        this.valueName = valueName;
        this.T = T;
        this.K = K;
    }

    @Override
    public Pair<T, K> map(ResultSet rs, StatementContext ctx) throws SQLException {
        return new Pair<>(rs.getObject(keyName, T), rs.getObject(valueName, K));
    }
}
