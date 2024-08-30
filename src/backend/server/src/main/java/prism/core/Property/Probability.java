package prism.core.Property;

import org.jdbi.v3.core.result.ResultIterator;
import parser.ast.ExpressionProb;
import parser.ast.PropertiesFile;
import parser.ast.RelOp;
import prism.PrismException;
import prism.Result;
import prism.StateValues;
import prism.api.Transition;
import prism.core.Model;
import prism.core.Timer;
import prism.db.Batch;
import prism.db.PersistentQuery;
import prism.db.mappers.StateAndValueMapper;
import prism.db.mappers.TransitionMapper;
import strat.MDStrategy;

import java.sql.SQLException;
import java.util.HashMap;
import java.util.Map;
import java.util.Optional;

public class Probability extends Property{

    public Probability(Model model, int id, PropertiesFile propertiesFile, parser.ast.Property prismProperty){
        super(model, id, propertiesFile, prismProperty);
        this.minimum = ((ExpressionProb) expression).getRelOp() == RelOp.MIN;
    }

    @Override
    public String modelCheck() throws PrismException {
        if (alreadyChecked) {
            Optional<String> out = model.getDatabase().executeLookupQuery(String.format("SELECT %s FROM %s WHERE %s = '%s'", ENTRY_R_INFO, model.getInfoTableName(), ENTRY_R_ID, id), String.class);
            return out.orElse("Unavailable");
        }

        if (model.debug) {
            System.out.println("-----------------------------------");
        }

        Result result;
        try (Timer time = new Timer(String.format("Checking %s", this.getName()), model.getLog())) {
            result = model.getPrism().modelCheck(propertiesFile, expression);
        } catch (Exception e) {
            throw new RuntimeException(e);
        }
        try (Timer time = new Timer(String.format("Insert %s to db", this.getName()), model.getLog())) {
            StateValues vals = (StateValues) result.getVector();
            StateAndValueMapper map = new StateAndValueMapper();

            vals.iterate(map, false);
            Map<Long, Double> values = map.output();

            try (Batch toExecute = model.getDatabase().createBatch(String.format("UPDATE %s SET %s = ? WHERE %s = ?", model.getStateTableName(), this.getPropertyCollumn(), ENTRY_S_ID), 2)) {
                for (Long stateID : values.keySet()) {
                    toExecute.addToBatch(String.valueOf(values.get(stateID)), String.valueOf(stateID));
                }
            } catch (SQLException e) {
                throw new RuntimeException(e);
            }

            MDStrategy strategy = (MDStrategy) result.getStrategy();

            try (Batch toExecute = model.getDatabase().createBatch(String.format("UPDATE %s SET %s = ?, %s = ? WHERE %s = ?", model.getTransitionTableName(), this.getPropertyCollumn(), this.getSchedulerCollumn(), ENTRY_T_ID), 3)) {
                String transitionQuery = String.format("SELECT * FROM %s", model.getTransitionTableName());

                if (strategy != null) {
                    try (PersistentQuery query = model.getDatabase().openQuery(transitionQuery); ResultIterator<Transition> it = query.iterator(new TransitionMapper(model))) {
                        while (it.hasNext()) {
                            Transition t = it.next();
                            int stateID = Integer.parseInt(t.getSource());

                            double value = 0.0;
                            for (Map.Entry<String, Double> entry : t.getProbabilityDistribution().entrySet()) {
                                value += entry.getValue() * values.get(Long.parseLong(entry.getKey()));
                            }

                            if (!strategy.isChoiceDefined(stateID) || t.getAction().equals(String.format("[%s]", strategy.getChoiceAction(stateID)))) {
                                toExecute.addToBatch(String.valueOf(value), "1.0", String.valueOf(t.getNumId()));
                            }
                        }
                    }
                } else if (minimum) {
                    Map<Integer, Double> min = new HashMap<>();
                    try (PersistentQuery query = model.getDatabase().openQuery(transitionQuery); ResultIterator<Transition> it = query.iterator(new TransitionMapper(model))) {
                        while (it.hasNext()) {
                            Transition t = it.next();
                            int stateID = Integer.parseInt(t.getSource());

                            double value = 0.0;
                            for (Map.Entry<String, Double> entry : t.getProbabilityDistribution().entrySet()) {
                                value += entry.getValue() * values.get(Long.parseLong(entry.getKey()));
                            }

                            if (!min.containsKey(stateID)) {
                                min.put(stateID, value);
                            } else {
                                if (min.get(stateID) > value) {
                                    min.replace(stateID, value);
                                }
                            }
                        }
                    }
                    try (PersistentQuery query = model.getDatabase().openQuery(transitionQuery); ResultIterator<Transition> it = query.iterator(new TransitionMapper(model))) {
                        while (it.hasNext()) {
                            Transition t = it.next();
                            int stateID = Integer.parseInt(t.getSource());

                            double value = 0.0;
                            for (Map.Entry<String, Double> entry : t.getProbabilityDistribution().entrySet()) {
                                value += entry.getValue() * values.get(Long.parseLong(entry.getKey()));
                            }
                            toExecute.addToBatch(String.valueOf(value), min.get(stateID) < value ? "0.0" : "1.0", String.valueOf(t.getNumId()));
                        }
                    }
                } else {
                    Map<Integer, Double> max = new HashMap<>();

                    try (PersistentQuery query = model.getDatabase().openQuery(transitionQuery); ResultIterator<Transition> it = query.iterator(new TransitionMapper(model))) {
                        while (it.hasNext()) {
                            Transition t = it.next();
                            int stateID = Integer.parseInt(t.getSource());

                            double value = 0.0;
                            for (Map.Entry<String, Double> entry : t.getProbabilityDistribution().entrySet()) {
                                value += entry.getValue() * values.get(Long.parseLong(entry.getKey()));
                            }

                            if (!max.containsKey(stateID)) {
                                max.put(stateID, value);
                            } else {
                                if (max.get(stateID) < value) {
                                    max.replace(stateID, value);
                                }
                            }
                        }
                    }
                    try (PersistentQuery query = model.getDatabase().openQuery(transitionQuery); ResultIterator<Transition> it = query.iterator(new TransitionMapper(model))) {
                        while (it.hasNext()) {
                            Transition t = it.next();
                            int stateID = Integer.parseInt(t.getSource());

                            double value = 0.0;
                            for (Map.Entry<String, Double> entry : t.getProbabilityDistribution().entrySet()) {
                                value += entry.getValue() * values.get(Long.parseLong(entry.getKey()));
                            }

                            toExecute.addToBatch(String.valueOf(value), max.get(stateID) > value ? "0.0" : "1.0", String.valueOf(t.getNumId()));
                        }
                    }
                }
                alreadyChecked = true;
                String out = result.getResultAndAccuracy();
                model.getDatabase().execute(String.format("INSERT INTO %s (%s,%s,%s) VALUES('%s','%s','%s')", model.getInfoTableName(), ENTRY_R_ID, ENTRY_R_NAME, ENTRY_R_INFO, this.id, this.name, out));
                return out;

            } catch (SQLException e) {
                throw new RuntimeException(e);
            }
        } catch (Exception e) {
            throw new RuntimeException(e);
        }
    }
}
