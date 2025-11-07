package prism.core.Scheduler;

import org.jdbi.v3.core.result.ResultIterator;
import parser.VarList;
import parser.ast.ModulesFile;
import prism.Pair;
import prism.PrismException;
import prism.core.Model;
import prism.db.PersistentQuery;
import prism.db.mappers.ArrayMapper;
import prism.db.mappers.PairMapper;

import java.io.BufferedWriter;
import java.io.File;
import java.io.FileWriter;
import java.io.IOException;
import java.sql.SQLException;
import java.util.*;
import java.util.stream.Collectors;

import static prism.core.Namespace.*;

public class Scheduler {

    private Model parent;
    private final int id;
    private final String name;


    private Scheduler(String name, int id, Model parent) {
        this.name = name;
        this.id = id;
        this.parent = parent;
    }

    public static Scheduler createScheduler(Model model, String name, int id, List<Criteria> criterias) throws SQLException {
        String table = model.getTableTrans();
        String schedTable = model.getTableSched();

        Optional<String> entry = model.getDatabase().executeLookupQuery(String.format("SELECT %s FROM %s WHERE %s = '%s'", ENTRY_SCH_NAME, schedTable, ENTRY_SCH_ID, id), String.class);

        if(entry.isPresent()){
            if (entry.get().equals(name)){
                return loadScheduler(name, id, model);
            }else{
                return createScheduler(model, name, id+1, criterias);
            }
        }

        String partition = ENTRY_T_OUT;
        StringBuilder order;
        if (criterias == null || criterias.isEmpty()){
             order = new StringBuilder(ENTRY_T_ACT + " " + "ASC");
        }else{
            order = new StringBuilder(criterias.get(0).getOrder());
            for (int i = 1; i < criterias.size(); i++){
                order.append(", ").append(criterias.get(i).getOrder());
            }
        }
        String scheduler_collumn = ENTRY_SCHED + id;

        String creationQuery = String.format("ALTER TABLE %s ADD COLUMN %s INTEGER NOT NULL DEFAULT 0", table, scheduler_collumn);
        String updateQuery = String.format("WITH cte AS (SELECT *, dense_rank() OVER(PARTITION BY %s ORDER BY %s) AS r FROM %s) UPDATE %s SET %s=1 WHERE %s IN (SELECT %s FROM cte WHERE r=1)", partition, order, table, table, scheduler_collumn, ENTRY_T_ID, ENTRY_T_ID);
        String infoQuery = String.format("INSERT INTO %s (%s, %s) VALUES(%s, '%s')", schedTable, ENTRY_SCH_ID, ENTRY_SCH_NAME, id, name);

        model.getDatabase().execute(creationQuery);
        model.getDatabase().execute(updateQuery);
        model.getDatabase().execute(infoQuery);

        return new Scheduler(name, id, model);
    }

    public static Scheduler loadScheduler(String name, int id, Model parent){
        return new Scheduler(name, id, parent);
    }

    public String getName() {
        return name;
    }

    public int getId() {
        return id;
    }

    public String getCollumnName(){
        return ENTRY_SCHED + id;
    }

    public prism.api.Scheduler getAPIScheduler() {

        ModulesFile modulesFile = parent.getModulesFile();
        String state_table = parent.getTableStates();

//        if (limit){
//            try {
//                state_table = this.createReachableTable();
//            } catch (Exception e) {
//                throw new RuntimeException(e);
//            }
//        }
//        int size = parent.getDatabase().executeLookupQuery(String.format("SELECT COUNT(*) FROM %s", state_table), Integer.class).orElse(0);

        try {
            //Variable Space
            List<prism.api.Scheduler.Variable> variables = new ArrayList<>();
            VarList varList = modulesFile.createVarList();

            for (int i = 0; i < varList.getNumVars(); i++) {
                variables.add(new prism.api.Scheduler.Variable(varList.getName(i), varList.getLow(i), varList.getHigh(i)));
            }

            //Action Space
            List<String> actions = modulesFile.getSynchs().stream().map(s -> "[" + s + "]").collect(Collectors.toList());

            Map<String, List<String>> stateMap = new HashMap<>();
            //BODY
            String transitionQuery = String.format(
                        "SELECT %s, array_agg(%s) AS actions \n" +
                        "FROM %s\n" +
                        "JOIN %s ON %s = %s \n" +
                        "WHERE %s = 1 GROUP BY %s\n" +
                        "ORDER BY %s"
                    , ENTRY_S_NAME
                    , ENTRY_T_ACT
                    , state_table
                    , parent.getTableTrans()
                    , ENTRY_S_ID
                    , ENTRY_T_OUT
                    , this.getCollumnName()
                    , ENTRY_S_NAME
                    , ENTRY_S_NAME);

            try (PersistentQuery query = parent.getDatabase().openQuery(transitionQuery); ResultIterator<Pair<String, List<String>>> it = query.iterator(new ArrayMapper<>(ENTRY_S_NAME, "actions", String.class, String.class))) {
                while (it.hasNext()) {
                    Pair<String, List<String>> out = it.next();
                    stateMap.put(out.getKey(), out.getValue());
                }
            }
            return new prism.api.Scheduler(variables, actions, stateMap);
        } catch (PrismException e) {
            throw new RuntimeException(e);
        }
        //if (limit) this.removeReachableTable(state_table);

    }
}
