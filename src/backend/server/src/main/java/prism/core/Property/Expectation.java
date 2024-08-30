package prism.core.Property;

import org.jdbi.v3.core.result.ResultIterator;
import parser.ast.ExpressionReward;
import parser.ast.PropertiesFile;
import prism.PrismException;
import prism.Result;
import prism.StateValues;
import prism.api.Transition;
import prism.core.Project;
import prism.core.Scheduler.Criteria;
import prism.core.Scheduler.CriteriaSort;
import prism.core.Scheduler.Scheduler;
import prism.core.Utility.Timer;
import prism.db.Batch;
import prism.db.PersistentQuery;
import prism.db.mappers.StateAndValueMapper;
import prism.db.mappers.TransitionMapper;
import strat.MDStrategy;

import java.sql.SQLException;
import java.util.Collections;
import java.util.Map;
import java.util.Optional;

public class Expectation extends Property{

    private Optional<Integer> rewardID = Optional.empty();
    public Expectation(Project project, int id, PropertiesFile propertiesFile, parser.ast.Property prismProperty){
        super(project, id, propertiesFile, prismProperty);
        this.minimum = ((ExpressionReward) expression).isMin();
    }

    public Expectation(Project project, int id, PropertiesFile propertiesFile, parser.ast.Property prismProperty, int rewardID){
        super(project, id, propertiesFile, prismProperty);
        this.minimum = ((ExpressionReward) expression).isMin();
        this.rewardID = Optional.of(rewardID);
    }

    @Override
    public String modelCheck() throws PrismException {
        if (alreadyChecked) {
            this.scheduler = Scheduler.loadScheduler(this.getName(), this.id);
            project.addScheduler(scheduler);
            Optional<String> out = project.getDatabase().executeLookupQuery(String.format("SELECT %s FROM %s WHERE %s = '%s'", ENTRY_R_INFO, project.getInfoTableName(), ENTRY_R_ID, id), String.class);
            return out.orElse("Unavailable");
        }

        if (project.debug) {
            System.out.println("-----------------------------------");
        }
        Result result;
        try (Timer time = new Timer(String.format("Checking %s", this.getName()), project.getLog())) {
            result = project.getPrism().modelCheck(propertiesFile, expression);
        } catch (Exception e) {
            throw new RuntimeException(e);
        }
        try (Timer time = new Timer(String.format("Insert %s to db", this.getName()), project.getLog())) {
            StateValues vals = (StateValues) result.getVector();
            StateAndValueMapper map = new StateAndValueMapper();

            vals.iterate(map, false);
            Map<Long, Double> values = map.output();

            try (Batch toExecute = project.getDatabase().createBatch(String.format("UPDATE %s SET %s = ? WHERE %s = ?", project.getStateTableName(), this.getPropertyCollumn(), ENTRY_S_ID), 2)) {
                for (Long stateID : values.keySet()) {
                    toExecute.addToBatch(String.valueOf(values.get(stateID)), String.valueOf(stateID));
                }
            } catch (SQLException e) {
                throw new RuntimeException(e);
            }

            MDStrategy strategy = (MDStrategy) result.getStrategy();

            try (Batch toExecute = project.getDatabase().createBatch(String.format("UPDATE %s SET %s = ? WHERE %s = ?", project.getTransitionTableName(), this.getPropertyCollumn(), ENTRY_T_ID), 2)) {
                String transitionQuery = String.format("SELECT * FROM %s", project.getTransitionTableName());

                String rewardName = "";
                if (rewardID.isPresent())
                    rewardName = project.getModulesFile().getRewardStructNames().get(rewardID.get());

                try (PersistentQuery query = project.getDatabase().openQuery(transitionQuery); ResultIterator<Transition> it = query.iterator(new TransitionMapper(project))) {
                    while (it.hasNext()) {
                        Transition t = it.next();

                        double value = t.getReward(rewardName);
                        for (Map.Entry<String, Double> entry : t.getProbabilityDistribution().entrySet()) {
                            value += entry.getValue() * values.get(Long.parseLong(entry.getKey()));
                        }

                        toExecute.addToBatch(String.valueOf(value), String.valueOf(t.getNumId()));
                    }
                }

            /*try (Batch toExecute = project.getDatabase().createBatch(String.format("UPDATE %s SET %s = ?, %s = ? WHERE %s = ?", project.getTransitionTableName(), this.getPropertyCollumn(), this.getSchedulerCollumn(), ENTRY_T_ID), 3)) {
                String transitionQuery = String.format("SELECT * FROM %s", project.getTransitionTableName());

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
            this.scheduler = Scheduler.createScheduler(this.project, this.getName(), this.id, Collections.singletonList(criteria));
            project.addScheduler(scheduler);
            alreadyChecked = true;
            String out = result.getResultAndAccuracy();
            project.getDatabase().execute(String.format("INSERT INTO %s (%s,%s,%s) VALUES('%s','%s','%s')", project.getInfoTableName(), ENTRY_R_ID, ENTRY_R_NAME, ENTRY_R_INFO, this.id, this.name, out));
            return out;
        } catch (Exception e) {
            throw new RuntimeException(e);
        }
    }
}
