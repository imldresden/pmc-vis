package prism.db;

import org.jdbi.v3.core.Handle;
import org.jdbi.v3.core.statement.PreparedBatch;

import java.sql.SQLException;

public class Batch implements AutoCloseable{

    Handle handle;

    String statement;

    int arguments;

    int batchSize;

    int maxBatchSize;

    PreparedBatch batch;

    boolean debug;

    protected Batch(Handle handle, String statement, int arguments, int batchSize, boolean debug){
        this.handle = handle;
        this.statement = statement;
        this.arguments = arguments;
        this.batchSize = 0;
        this.maxBatchSize = batchSize;
        batch = handle.prepareBatch(statement);
        this.debug = debug;
    }

    public void addToBatch(String ... values) throws SQLException {
        if (values.length != arguments){
            throw new SQLException("Wrong number of arguments");
        }
        for (int j = 0; j < arguments; j++){
            batch.bind(j, values[j]);
        }
        batch.add();
        if (++batchSize >= maxBatchSize){
            execute();
        }
    }

    public void execute(){
        if (batchSize == 0){
            return;
        }
        long time = 0;
        if (debug){
            time = System.currentTimeMillis();
            System.out.println("EXECUTE: " + statement+ " WITH " + batchSize + " ENTRIES");
        }
        batch.execute();
        if (debug){
            long time2 = System.currentTimeMillis() - time;
            if (time2 > 0) {
                System.out.println(String.format("Done in %s ms. %s inserts per ms", time2, batchSize / time2));
            }
        }
        batchSize = 0;
    }

    @Override
    public void close() {
        execute();
        handle.close();
    }
}
