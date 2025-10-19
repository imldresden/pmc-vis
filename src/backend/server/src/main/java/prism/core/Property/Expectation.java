package prism.core.Property;

import org.jdbi.v3.core.result.ResultIterator;
import parser.ast.ExpressionReward;
import parser.ast.PropertiesFile;
import parser.type.TypeDouble;
import prism.PrismException;
import prism.Result;
import prism.StateValues;
import prism.api.Transition;
import prism.api.VariableInfo;
import prism.core.Model;
import prism.core.Scheduler.Criteria;
import prism.core.Scheduler.CriteriaSort;
import prism.core.Scheduler.Scheduler;
import prism.core.Utility.Timer;
import prism.db.Batch;
import prism.db.PersistentQuery;
import prism.db.mappers.StateAndValueMapper;
import prism.db.mappers.TransitionMapper;
import strat.MDStrategy;

import java.math.BigInteger;
import java.sql.SQLException;
import java.util.Collections;
import java.util.Map;
import java.util.Optional;

public class Expectation extends Property{

    private Optional<Integer> rewardID = Optional.empty();
    public Expectation(Model model, int id, PropertiesFile propertiesFile, parser.ast.Property prismProperty){
        super(model, id, propertiesFile, prismProperty);
        this.minimum = ((ExpressionReward) expression).isMin();
    }

    public Expectation(Model model, int id, PropertiesFile propertiesFile, parser.ast.Property prismProperty, int rewardID){
        super(model, id, propertiesFile, prismProperty);
        this.minimum = ((ExpressionReward) expression).isMin();
        this.rewardID = Optional.of(rewardID);
    }

    @Override
    public VariableInfo modelCheck() throws PrismException {
        if (alreadyChecked) {
            return this.getPropertyInfo();
        }

        if (model.debug) {
            System.out.println("-----------------------------------");
        }
        Result result;
        try (Timer time = new Timer(String.format("Checking %s", this.getName()), model.getLog())) {
            result = model.getModelChecker().getPrism().modelCheck(propertiesFile, expression);
        } catch (Exception e) {
            throw new RuntimeException(e);
        }
        try (Timer time = new Timer(String.format("Insert %s to db", this.getName()), model.getLog())) {
            StateValues vals = (StateValues) result.getVector();
            StateAndValueMapper map = new StateAndValueMapper(model.getModelParser());

            vals.iterate(map, false);
            Map<BigInteger, Double> values = map.output();

            model.getDatabase().execute(String.format("ALTER TABLE %s ADD COLUMN %s TEXT", model.getTableStates(), this.getPropertyCollumn()));
            model.getDatabase().execute(String.format("ALTER TABLE %s ADD COLUMN %s TEXT", model.getTableTrans(), this.getPropertyCollumn()));

            try (Batch toExecute = model.getDatabase().createBatch(String.format("UPDATE %s SET %s = ? WHERE %s = ?", model.getTableStates(), this.getPropertyCollumn(), ENTRY_S_ID), 2)) {
                for (BigInteger stateID : values.keySet()) {
                    toExecute.addToBatch(String.valueOf(values.get(stateID)), String.valueOf(stateID));
                }
            } catch (SQLException e) {
                throw new RuntimeException(e);
            }

            MDStrategy strategy = (MDStrategy) result.getStrategy();

            try (Batch toExecute = model.getDatabase().createBatch(String.format("UPDATE %s SET %s = ? WHERE %s = ?", model.getTableTrans(), this.getPropertyCollumn(), ENTRY_T_ID), 2)) {
                String transitionQuery = String.format("SELECT * FROM %s", model.getTableTrans());

                String rewardName = "";
                if (rewardID.isPresent())
                    rewardName = model.getModulesFile().getRewardStructNames().get(rewardID.get());

                try (PersistentQuery query = model.getDatabase().openQuery(transitionQuery); ResultIterator<Transition> it = query.iterator(new TransitionMapper(model))) {
                    while (it.hasNext()) {
                        Transition t = it.next();

                        double value = t.getReward(rewardName);
                        for (Map.Entry<String, Double> entry : t.getProbabilityDistribution().entrySet()) {
                            value += entry.getValue() * values.get(new BigInteger(entry.getKey()));
                        }

                        toExecute.addToBatch(String.valueOf(value), String.valueOf(t.getNumId()));
                    }
                }

            /*try (Batch toExecute = project.getDatabase().createBatch(String.format("UPDATE %s SET %s = ?, %s = ? WHERE %s = ?", project.getTableTrans(), this.getPropertyCollumn(), this.getSchedulerCollumn(), ENTRY_T_ID), 3)) {
                String transitionQuery = String.format("SELECT * FROM %s", project.getTableTrans());

                String rewardName = "";
                if (rewardID.isPresent())
                    rewardName = project.getModulesFile().getRewardStructNames().get(rewardID.get());

                if (strategy != null) {
                    try (PersistentQuery query = project.getDatabase().openQuery(transitionQuery); ResultIterator<Transition> it = query.iterator(new TransitionMapper(project))) {
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
                    try (PersistentQuery query = project.getDatabase().openQuery(transitionQuery); ResultIterator<Transition> it = query.iterator(new TransitionMapper(project))) {
                        while (it.hasNext()) {
                            Transition t = it.next();
                            int stateID = Integer.parseInt(t.getSource());

                            double value = t.getReward(rewardName);
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
                    try (PersistentQuery query = project.getDatabase().openQuery(transitionQuery); ResultIterator<Transition> it = query.iterator(new TransitionMapper(project))) {
                        while (it.hasNext()) {
                            Transition t = it.next();
                            int stateID = Integer.parseInt(t.getSource());

                            double value = t.getReward(rewardName);
                            for (Map.Entry<String, Double> entry : t.getProbabilityDistribution().entrySet()) {
                                value += entry.getValue() * values.get(Long.parseLong(entry.getKey()));
                            }


                            toExecute.addToBatch(String.valueOf(value), min.get(stateID) < value ? "0.0" : "1.0", String.valueOf(t.getNumId()));
                        }
                    }
                } else {
                    Map<Integer, Double> max = new HashMap<>();

                    try (PersistentQuery query = project.getDatabase().openQuery(transitionQuery); ResultIterator<Transition> it = query.iterator(new TransitionMapper(project))) {
                        while (it.hasNext()) {
                            Transition t = it.next();
                            int stateID = Integer.parseInt(t.getSource());

                            double value = t.getReward(rewardName);
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
                    try (PersistentQuery query = project.getDatabase().openQuery(transitionQuery); ResultIterator<Transition> it = query.iterator(new TransitionMapper(project))) {
                        while (it.hasNext()) {
                            Transition t = it.next();
                            int stateID = Integer.parseInt(t.getSource());

                            double value = t.getReward(rewardName);
                            for (Map.Entry<String, Double> entry : t.getProbabilityDistribution().entrySet()) {
                                value += entry.getValue() * values.get(Long.parseLong(entry.getKey()));
                            }

                            toExecute.addToBatch(String.valueOf(value), max.get(stateID) > value ? "0.0" : "1.0", String.valueOf(t.getNumId()));
                        }
                    }
                }*/
            } catch (SQLException e) {
                throw new RuntimeException(e);
            }
            Criteria criteria = new CriteriaSort(this.getPropertyCollumn(), minimum ? CriteriaSort.Direction.ASC: CriteriaSort.Direction.DESC);
            this.scheduler = Scheduler.createScheduler(this.model, this.getName(), this.id, Collections.singletonList(criteria));
            model.addScheduler(scheduler);
            this.newMaximum();
            alreadyChecked = true;

            return this.getPropertyInfo();
        } catch (Exception e) {
            throw new RuntimeException(e);
        }
    }
}
