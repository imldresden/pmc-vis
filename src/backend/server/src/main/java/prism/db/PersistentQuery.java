package prism.db;

import org.jdbi.v3.core.Handle;
import org.jdbi.v3.core.mapper.RowMapper;
import org.jdbi.v3.core.result.ResultIterator;
import org.jdbi.v3.core.statement.Query;

import java.util.stream.Stream;

public class PersistentQuery implements AutoCloseable{

    Handle handle;

    String statement;

    Query query;

    boolean debug;

    protected PersistentQuery(Handle handle, String statement, boolean debug){
        this.handle = handle;
        this.statement = statement;
        if (debug){
            System.out.println("Query: " + statement);
        }
        query = handle.createQuery(statement);
        this.debug = debug;
    }

    public <T> ResultIterator<T> iterator(RowMapper<T> mapper){
        return query.map(mapper).iterator();
    }

    public <T> Stream<T> stream(RowMapper<T> mapper){
        return query.map(mapper).stream();
    }

    @Override
    public void close() {
        query.close();
        handle.close();
    }
}
