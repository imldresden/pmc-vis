package prism.core.Property;

import org.jdbi.v3.core.result.ResultIterator;
import parser.VarList;
import parser.ast.*;
import parser.type.Type;
import prism.Pair;
import prism.PrismException;
import prism.api.State;
import prism.api.Transition;
import prism.core.Model;
import prism.core.Namespace;
import prism.db.PersistentQuery;
import prism.db.mappers.PairMapper;
import prism.db.mappers.TransitionMapper;

import java.io.BufferedWriter;
import java.io.File;
import java.io.FileWriter;
import java.io.IOException;
import java.sql.SQLException;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.stream.Collectors;

public abstract class Property implements Namespace {

    protected int id;

    protected Model model;
    protected String name;
    protected Expression expression;
    protected PropertiesFile propertiesFile;

    protected boolean minimum = false;

    protected boolean alreadyChecked = false;

    public Property(Model model, int id, PropertiesFile propertiesFile, parser.ast.Property prismProperty){
        this.model = model;
        this.id = id;
        this.name = prismProperty.getName() != null ? prismProperty.getName() : prismProperty.getExpression().toString();
        this.expression = prismProperty.getExpression();
        this.propertiesFile = propertiesFile;

        try {
            if (model.getDatabase().question(String.format("SELECT name FROM pragma_table_info('%s') WHERE name = '%s'", model.getStateTableName(), this.getPropertyCollumn()))){
                alreadyChecked = true;
            }else {
                model.getDatabase().execute(String.format("ALTER TABLE %s ADD COLUMN %s TEXT", model.getStateTableName(), this.getPropertyCollumn()));
                model.getDatabase().execute(String.format("ALTER TABLE %s ADD COLUMN %s TEXT", model.getTransitionTableName(), this.getPropertyCollumn()));
                model.getDatabase().execute(String.format("ALTER TABLE %s ADD COLUMN %s REAL DEFAULT 0.0", model.getTransitionTableName(), this.getSchedulerCollumn()));
            }
        } catch (SQLException e) {
            throw new RuntimeException(e);
        }
    }

    public static Property createProperty(Model model, int id, PropertiesFile propertiesFile, parser.ast.Property prismProperty){
        Expression expression = prismProperty.getExpression();

        // P operator
        if (expression instanceof ExpressionProb) {
            return new Probability(model, id, propertiesFile, prismProperty);
        }
        // R operator
        else if (expression instanceof ExpressionReward) {
            try {
                return new Expectation(model, id, propertiesFile, prismProperty, ((ExpressionReward) expression).getRewardStructIndexByIndexObject(model.getModulesFile().getRewardStructNames(), model.getModulesFile().getConstantValues()));
            } catch (PrismException e) {
                return new Expectation(model, id, propertiesFile, prismProperty);
            }
            // Fallback (should not happen)
        }else{
            throw new RuntimeException(String.format("Expression %s not understood", expression));
        }
    }

    public int getID() {return id;}

    public String getName() {return name;}

    public String getPropertyCollumn(){
        return ENTRY_PROP + id;
    }

    public String getSchedulerCollumn(){
        return ENTRY_SCHED + id;
    }

    public abstract String modelCheck() throws PrismException;

    public void printScheduler(String filename) {
        File f = new File(filename);
        ModulesFile modulesFile = model.getModulesFile();

        try(BufferedWriter writer = new BufferedWriter(new FileWriter(f))) {
            //HEADER
            VarList varList = modulesFile.createVarList();
            writer.write(String.format("%s;", varList.getNumVars()));
            System.out.printf("%s;", varList.getNumVars());
            for (int i = 0; i < varList.getNumVars();i++){
                writer.write(String.format("%s[%s..%s];", varList.getName(i), varList.getLow(i), varList.getHigh(i)));
                System.out.printf("%s[%s..%s];", varList.getName(i), varList.getLow(i), varList.getHigh(i));
            }
            writer.write(String.format("%s;%s;%s", modulesFile.getSynchs().size(), modulesFile.getSynchs().stream().map(s -> "[" + s + "]").collect(Collectors.joining(";")), model.getSize()));
            System.out.printf("%s;%s;%s", modulesFile.getSynchs().size(), modulesFile.getSynchs().stream().map(s -> "[" + s + "]").collect(Collectors.joining(";")), model.getSize());
            //BODY
            writer.newLine();

            String transitionQuery = String.format("SELECT %s, GROUP_CONCAT(%s, ';') AS actions FROM %s JOIN %s ON %s = %s WHERE %s = 1 GROUP BY %s", ENTRY_S_NAME, ENTRY_T_ACT, model.getStateTableName(), model.getTransitionTableName(), ENTRY_S_ID, ENTRY_T_OUT, this.getSchedulerCollumn(), ENTRY_S_NAME);

            try(PersistentQuery query = model.getDatabase().openQuery(transitionQuery); ResultIterator<Pair<String, String>> it = query.iterator(new PairMapper<>(ENTRY_S_NAME, "actions", String.class, String.class))) {
                while (it.hasNext()) {
                    Pair<String, String> out = it.next();
                    String s = String.format("%s;%s", out.getKey(), String.join(";", out.getValue()));
                    writer.write(s);
                    writer.newLine();
                }
            }
        } catch (IOException | PrismException e) {
            throw new RuntimeException(e);
        }
    }

    private List<String> getNextActions(String id) {
        List<String> output = model.getDatabase().executeCollectionQuery(String.format("SELECT %s FROM %s WHERE %s = '%s' AND %s = 1", ENTRY_T_ACT, model.getTransitionTableName(), ENTRY_T_OUT, id, this.getSchedulerCollumn()), String.class);
        return output;
    }
}
