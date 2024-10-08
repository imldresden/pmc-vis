package prism.db;

import org.jdbi.v3.core.Handle;
import org.jdbi.v3.core.Jdbi;
import org.jdbi.v3.core.mapper.RowMapper;
import org.jdbi.v3.core.statement.Batch;
import org.jdbi.v3.core.statement.PreparedBatch;
import org.jdbi.v3.core.statement.Query;

import java.sql.*;
import java.util.List;
import java.util.Map;
import java.util.Optional;

/**
 * Class creating the connection to the database safely. Also handling all requests to said database.
 */
public class Database{

    protected Jdbi jdbi;

    private final boolean debug;

    public Database(Jdbi jdbi, boolean debug){
        this.jdbi = jdbi;
        this.debug = debug;

        try(Handle handle = jdbi.open()){
            handle.execute("pragma journal_mode = WAL;");
            handle.execute("pragma synchronous = OFF;");
            handle.execute("pragma temp_store = memory;");
            handle.execute("pragma mmap_size = 30000000000;");
        }
    }

    /*
    Direct SQL PersistentQuery Functions. Use with caution
     */
    public void execute(String qry) throws SQLException {
        if (debug){
            System.out.println("EXECUTE: " + qry);
        }
        try(Handle handle = jdbi.open()){
            handle.execute(qry);
        }
    }

    public void executeBatch(List<String> qrys) {
        try(Handle handle = jdbi.open()){
            long time = System.currentTimeMillis();
            if (debug){
                System.out.println("EXECUTE " + qrys.size() + " of " + qrys.get(0));
            }
            Batch batch = handle.createBatch();
            for (String qry : qrys){
                batch.add(qry);
            }
            batch.execute();
            if (debug){
                System.out.printf("Done in %s ms. %s inserts per ms%n", System.currentTimeMillis()-time, qrys.size()/(System.currentTimeMillis()-time));

            }
        }
    }

    public void insertBatch(String head, List<String> ... collumns) {
        try(Handle handle = jdbi.open()){
            long time = System.currentTimeMillis();
            if (debug){
                System.out.println("EXECUTE " + head+ "WITH" + collumns[0].size() + "ENTRIES");
            }
            PreparedBatch batch = handle.prepareBatch(head);
            for (int i = 0; i < collumns[0].size(); i++){
                for (int j = 0; j < collumns.length; j++){
                    batch.bind(j, collumns[j].get(i));
                }
                batch.add();
            }
            batch.execute();
            if (debug){
                System.out.printf("Done in %s ms. %s inserts per ms%n", System.currentTimeMillis()-time, collumns[0].size()/(System.currentTimeMillis()-time));
            }
        }
    }

    public prism.db.Batch createBatch(String statement, int arguments){
        Handle h = jdbi.open();
        return new prism.db.Batch(h, statement, arguments, getMaxBatchSize(), debug);
    }

    //public Query executeQuery(String qry) throws SQLException {
    //    try(Handle handle = jdbi.open()) {
    //        return handle.createQuery(qry);
    //    }
    //}

    public <T> Optional<T> executeLookupQuery(String qry, Class<T> returnType){
        if (debug){
            System.out.println("EXECUTE: " + qry);
        }
        try(Handle handle = jdbi.open()) {
            return handle.createQuery(qry).mapTo(returnType).findOne();
        }
    }

    public Optional<Map<String, Object>> executeLookupQuery(String qry){
        if (debug){
            System.out.println("EXECUTE: " + qry);
        }
        try(Handle handle = jdbi.open()) {
            return handle.createQuery(qry).mapToMap().findOne();
        }
    }

    public <T> Optional<T> executeLookupQuery(String qry, RowMapper<T> mapper){
        if (debug){
            System.out.println("EXECUTE: " + qry);
        }
        try(Handle handle = jdbi.open()) {
            return handle.createQuery(qry).map(mapper).findOne();
        }
    }

    public List<Map<String, Object>> executeCollectionQuery(String qry){
        if (debug){
            System.out.println("EXECUTE: " + qry);
        }
        try(Handle handle = jdbi.open()) {
            return handle.createQuery(qry).mapToMap().list();
        }
    }

    public <T> List<T> executeCollectionQuery(String qry, Class<T> returnType){
        if (debug){
            System.out.println("EXECUTE: " + qry);
        }
        try(Handle handle = jdbi.open()) {
            return handle.createQuery(qry).mapTo(returnType).list();
        }
    }

    public <T> List<T> executeCollectionQuery(String qry, RowMapper<T> mapper){
        if (debug){
            System.out.println("EXECUTE: " + qry);
        }
        try(Handle handle = jdbi.open()) {
            return handle.createQuery(qry).map(mapper).list();
        }
    }

    public  PersistentQuery openQuery(String qry) {
        Handle h = jdbi.open();
        return new PersistentQuery(h, qry, debug);
    }

    public boolean question(String qry){
        if (debug){
            System.out.println("EXISTS: " + qry);
        }
        try(Handle handle = jdbi.open()) {
            Optional<Boolean> result = handle.createQuery(qry).mapTo(Boolean.TYPE).findOne();
            if (debug){
                System.out.println(result.isPresent());
            }
            return result.isPresent();
        }
    }

    public int getMaxBatchSize() {
        return 500000;
    }
}
