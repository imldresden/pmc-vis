package prism.core;

import parser.State;
import parser.ast.Expression;
import parser.ast.ExpressionReward;
import parser.ast.ModulesFile;
import parser.ast.PropertiesFile;
import prism.*;
import prism.core.Property.Property;
import prism.core.Scheduler.Scheduler;
import prism.core.Utility.Prism.MDStrategyDB;
import prism.core.Utility.Prism.Updater;
import prism.core.Utility.Timer;
import prism.db.Batch;
import simulator.Choice;
import simulator.SimulatorEngine;
import simulator.TransitionList;
import simulator.method.*;
import strat.StrategyGenerator;

import java.io.*;
import java.sql.SQLException;
import java.util.*;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.stream.Collectors;

public class ModelChecker implements Namespace{

    private final Project project;
    private final Prism prism;
    private final ModulesFile modulesFile;
    private prism.Model model;
    private final Updater updater;

    private final String stateTable;
    private final String transTable;

    private final String schedTable;
    private final String resTable;

    public ModelChecker(Project project, File modelFile, String stateTable, String transTable, String schedTable, String resTable, String cuddMaxMem, int numIterations, boolean debug) throws Exception {
        this.project = project;
        this.stateTable = stateTable;
        this.transTable = transTable;
        this.schedTable = schedTable;
        this.resTable = resTable;
        if (debug) this.prism = new Prism(new PrismPrintStreamLog(System.out));
        else this.prism = new Prism(new PrismDevNullLog());
        prism.setCUDDMaxMem(cuddMaxMem);
        prism.setEngine(1);
        prism.setMaxIters(numIterations);

        prism.initialise();
        prism.setStoreVector(true);

        try (prism.core.Utility.Timer parse = new prism.core.Utility.Timer("parsing project", project.getLog())){
            ModulesFile modulesFile = prism.parseModelFile(modelFile, ModelType.MDP);
            prism.loadPRISMModel(modulesFile);
            this.modulesFile = modulesFile;
        } catch (FileNotFoundException e) {
            throw new Exception(e.getMessage());
        }

        this.updater = new Updater(modulesFile, prism);
    }

    @Deprecated
    public static void runProfeat(Project project, File profeatFile, File propertyFile, long cuddMaxMem, int numIterations, int numThreads, boolean debug) throws Exception {
        File modelDir = new File(profeatFile.getParentFile(), "parts");
        if (modelDir.exists())
            modelDir.delete();
        modelDir.mkdir();
        //Create single models for every family member
        try {

            Process process
                    = Runtime.getRuntime().exec(String.format("profeat %s -t -o %s/model.prism --one-by-one", profeatFile, modelDir));

            StringBuilder output = new StringBuilder();

            BufferedReader reader
                    = new BufferedReader(new InputStreamReader(
                    process.getInputStream()));

            String line;
            while ((line = reader.readLine()) != null) {
                output.append(line + "\n");
            }

            int exitVal = process.waitFor();
            if (exitVal == 0) {
                System.out.println(
                        "Translated ProFeat file to Prism files");
                System.out.println(output);
            }else
                throw new RuntimeException(String.format("Could not translate profeat file:\n%s", output));
        }
        catch (InterruptedException e) {
            throw new RuntimeException(e);
        } catch (IOException e) {
            throw new RuntimeException(e);
        }

        String cuddMem = String.format("%dm", cuddMaxMem/(numThreads*2));

        //load every resulting model into its own modelchecker instance
        List<ModelChecker> instances = new ArrayList<>();
        int i = 0;
        for (File file : modelDir.listFiles()){
            String stateTable = String.format("%s_%s", project.getStateTableName(), i);
            String transTable = String.format("%s_%s", project.getTransitionTableName(), i);
            String schedTable = String.format("%s_%s", project.getSchedulerTableName(), i);
            String resTable = String.format("%s_%s", project.getInfoTableName(), i);
            ModelChecker instance = new ModelChecker(project, file, stateTable, transTable, schedTable, resTable, cuddMem, numIterations, debug);
            instances.add(instance);
            i++;
        }

        //compute the familiy at parallel
        ExecutorService executorService = Executors.newFixedThreadPool(numThreads);
        List<CompletableFuture<Void>> futures = new ArrayList<>();
        for(ModelChecker instance : instances){
            CompletableFuture<Void> future = CompletableFuture.runAsync(() -> {
                try {
                    instance.buildModel();
                    instance.modelCheckingFromFile(propertyFile.getPath());
                } catch (Exception e) {
                    throw new RuntimeException(e);
                }
            }, executorService);
            futures.add(future);
        }
        CompletableFuture.allOf(futures.toArray(new CompletableFuture[0])).join();
        executorService.shutdown();

        //Gather all results into database

    }

    public static File translateProFeat(File profeatFile, File targetFile){
        try {
            Process process
                    = Runtime.getRuntime().exec(String.format("profeat %s -t -o %s", profeatFile.getPath(), targetFile.getPath()));

            StringBuilder output = new StringBuilder();

            BufferedReader reader
                    = new BufferedReader(new InputStreamReader(
                    process.getInputStream()));

            String line;
            while ((line = reader.readLine()) != null) {
                output.append(line + "\n");
            }

            int exitVal = process.waitFor();
            if (exitVal == 0) {
                System.out.println(
                        "Translated ProFeat file to Prism file");
                System.out.println(output);
                File existingFile = new File(targetFile.getPath());
                return existingFile;
            }else
                throw new RuntimeException(String.format("Could not translate profeat file:\n%s", output));
        }
        catch (InterruptedException e) {
            throw new RuntimeException(e);
        } catch (IOException e) {
            throw new RuntimeException(e);
        }
    }

    public Prism getPrism() {
        return this.prism;
    }

    public Updater getUpdater(){
        return this.updater;
    }

    public Model getModel(){
        return this.model;
    }

    public ModulesFile getModulesFile(){
        return this.modulesFile;
    }

    public void buildModel() throws PrismException{
        TreeMap<String, Object> info = new TreeMap<>();

        try(prism.core.Utility.Timer build = new prism.core.Utility.Timer("Build Project", project.getLog())) {
            prism.buildModelIfRequired();
        } catch (Exception e) {
            throw new RuntimeException(e);
        }
        this.model = prism.getBuiltModel();
        if (model == null) {
            return;
        }
        info.put("States", model.getNumStatesString());
        info.put("Transitions", model.getNumTransitionsString());
        if (!project.isBuilt()) {
            try(prism.core.Utility.Timer build = new Timer("Build Database", project.getLog())){
                int numRewards = modulesFile.getNumRewardStructs();
                try {
                    project.getDatabase().execute(String.format("CREATE TABLE %s (%s INTEGER PRIMARY KEY NOT NULL, %s TEXT, %s BOOLEAN)", stateTable , ENTRY_S_ID, ENTRY_S_NAME, ENTRY_S_INIT));
                    project.getDatabase().execute(String.format("CREATE TABLE %s (%s INTEGER PRIMARY KEY, %s INTEGER NOT NULL, %s TEXT, %s INTEGER);", transTable, ENTRY_T_ID, ENTRY_T_OUT, ENTRY_T_ACT, ENTRY_T_PROB));
                    project.getDatabase().execute(String.format("CREATE TABLE %s (%s TEXT, %s TEXT)", schedTable, ENTRY_SCH_ID, ENTRY_SCH_NAME));
                    project.getDatabase().execute(String.format("CREATE TABLE %s (%s TEXT, %s TEXT, %s TEXT)", resTable, ENTRY_R_ID, ENTRY_R_NAME, ENTRY_R_INFO));

                    for (int i = 0; i < numRewards; i++){
                        project.getDatabase().execute(String.format("ALTER TABLE %s ADD COLUMN %s TEXT", stateTable , ENTRY_REW + i));
                        project.getDatabase().execute(String.format("ALTER TABLE %s ADD COLUMN %s TEXT", transTable, ENTRY_REW + i));
                    }

                } catch (SQLException e) {
                    throw new RuntimeException(e.toString());
                }

                List<String> stateList = this.model.getReachableStates().exportToStringList();
                Map<State, Integer> states = new HashMap<>();

                String stateInsertCall = String.format("INSERT INTO %s (%s,%s,%s) VALUES(?,?,?)", stateTable , ENTRY_S_ID, ENTRY_S_NAME, ENTRY_S_INIT);
                String transitionInsertCall = String.format("INSERT INTO %s(%s,%s,%s) VALUES (?,?,?)", transTable, ENTRY_T_OUT, ENTRY_T_ACT, ENTRY_T_PROB);
                if (numRewards > 0){
                    String[] rewardHeader = new String[numRewards];
                    String[] questionHeader = new String[numRewards];
                    for (int i=0; i < numRewards; i++){
                        rewardHeader[i] = ENTRY_REW + i;
                        questionHeader[i] = "?";
                    }
                    stateInsertCall = String.format("INSERT INTO %s (%s,%s,%s,%s) VALUES(?,?,?,%s)", stateTable , ENTRY_S_ID, ENTRY_S_NAME, ENTRY_S_INIT, String.join(",", rewardHeader), String.join(",", questionHeader));
                    transitionInsertCall = String.format("INSERT INTO %s(%s,%s,%s,%s) VALUES (?,?,?,%s)", transTable, ENTRY_T_OUT, ENTRY_T_ACT, ENTRY_T_PROB, String.join(",", rewardHeader), String.join(",",questionHeader));
                }

                try(Batch toExecute = project.getDatabase().createBatch(stateInsertCall, 3 + numRewards)){
                    for (int i = 0; i < stateList.size(); i++) {
                        String stateName = project.normalizeStateName(stateList.get(i));
                        parser.State s = project.parseState(stateName);

                        //Determine whether this is an initial state or not
                        Expression initialExpression = modulesFile.getInitialStates();
                        boolean initial;
                        if (initialExpression == null){
                            initial = modulesFile.getDefaultInitialState().equals(s);
                        }else{
                            initial = initialExpression.evaluateBoolean(s);
                        }

                        //Create State in table
                        if (numRewards > 0){
                            double[] rewards = new double[numRewards];
                            updater.calculateStateRewards(s, rewards);
                            String[] inputs = new String[numRewards+3];
                            inputs[0] = Integer.toString(i);
                            inputs[1] = stateName;
                            inputs[2] = initial ? "1" : "0";
                            for (int j = 0; j < numRewards; j++){
                                inputs[j+3] = String.valueOf(rewards[j]);
                            }
                            toExecute.addToBatch(inputs);
                        }else{
                            toExecute.addToBatch(Integer.toString(i), stateName, initial ? "1" : "0");
                        }

                        states.put(s, i);
                    }
                } catch (SQLException e) {
                    throw new RuntimeException(e);
                }

                try(Batch toExecute = project.getDatabase().createBatch(transitionInsertCall, 3 + numRewards)) {
                    for (parser.State s : states.keySet()) {
                        TransitionList<Double> transitionList = new TransitionList<>(Evaluator.forDouble());
                        updater.calculateTransitions(s, transitionList);
                        for (int i = 0; i < transitionList.getNumChoices(); i++) {
                            Choice<Double> choice = transitionList.getChoice(i);
                            String actionName = choice.getModuleOrAction();

                            Map<Integer, Double> probabilities = new HashMap<>();

                            for (int j = 0; j < choice.size(); j++) {
                                double probability = choice.getProbability(j);
                                parser.State target = choice.computeTarget(j, s, modulesFile.createVarList());
                                probabilities.put(states.get(target), probability);
                            }
                            if (numRewards > 0){
                                double[] rewards = new double[numRewards];
                                updater.calculateTransitionRewards(s, i, rewards);
                                String[] inputs = new String[numRewards+3];
                                inputs[0] = String.valueOf(states.get(s));
                                inputs[1] = actionName;
                                inputs[2] = probabilities.entrySet().stream().map(e -> String.format("%s:%s", e.getKey(), e.getValue())).collect(Collectors.joining(";"));
                                for (int j = 0; j < numRewards; j++){
                                    inputs[j+3] = String.valueOf(rewards[j]);
                                }
                                toExecute.addToBatch(inputs);
                            }else{
                                toExecute.addToBatch(String.valueOf(states.get(s)), actionName, probabilities.entrySet().stream().map(e -> String.format("%s:%s", e.getKey(), e.getValue())).collect(Collectors.joining(";")));
                            }

                        }
                    }
                } catch (SQLException e) {
                    throw new RuntimeException(e);
                }
            } catch (Exception e) {
                throw new RuntimeException(e);
            }
        }
    }

    public TreeMap<String, String> checkModel(PropertiesFile propertiesFile) throws PrismException {
        buildModel();
        TreeMap<String, String> info = new TreeMap<>();

        //if (((NondetModel) prism.getBuiltModel()).areAllChoiceActionsUnique()){
        //    prism.setGenStrat(true);
        //}

        if (propertiesFile == null) {
            propertiesFile = prism.parsePropertiesString("");
        }

        for (int i = 0; i < propertiesFile.getNumProperties(); i++) {
            String name = project.newProperty(propertiesFile, i);
            Optional<Property> p = project.getProperty(name);
            if (p.isPresent()){
                info.put(name, p.get().modelCheck());
            }
        }
        return info;
    }

    public TreeMap<String, String> modelCheckingFromFile(String path) throws Exception {
        PropertiesFile propertiesFile = prism.parsePropertiesFile(new File(path));
        return checkModel(propertiesFile);
    }

    public List<Result[]> modelCheckSimulator(File properties, List<State> initialStates, long maxPathLength, String simulationMethod, boolean parallel, Optional<Scheduler> scheduler) throws Exception {

        PropertiesFile propertiesFile = prism.parsePropertiesFile(properties);
        SimulatorEngine simulator = prism.getSimulator();
        PrismLog mainLog = prism.getMainLog();
        List<Expression> exprs = new ArrayList<>();

        ModelGenerator<Double> modelGen = (ModelGenerator<Double>) prism.getModelGenerator();
        RewardGenerator<Double> rewardGen;
        if (modelGen instanceof RewardGenerator) {
            rewardGen = (RewardGenerator<Double>) modelGen;
        } else {
            rewardGen = new RewardGenerator<>() {};
        }

        simulator.loadModel(modelGen, rewardGen);

        for (int i=0; i< propertiesFile.getNumProperties(); i++){
            exprs.add(propertiesFile.getProperty(i));
        }
        if (scheduler.isPresent()) {
            StrategyGenerator<Double> strategy = new MDStrategyDB(model, project.getDatabase(), project.getTransitionTableName(), scheduler.get().getCollumnName(), true);
            simulator.loadStrategy(strategy);
        }

        // Print info
        mainLog.printSeparator();
        mainLog.print("\nSimulating");
        if (exprs.size() == 1) {
            mainLog.println(": " + exprs.get(0));
        } else {
            mainLog.println(" " + exprs.size() + " properties:");
            for (int i = 0; i < exprs.size(); i++) {
                mainLog.println(" " + exprs.get(i));
            }
        }
        //if (currentDefinedMFConstants != null && currentDefinedMFConstants.getNumValues() > 0)
        //    mainLog.println("Model constants: " + currentDefinedMFConstants);
        //if (definedPFConstants != null && definedPFConstants.getNumValues() > 0)
        //    mainLog.println("Property constants: " + definedPFConstants);

        if (prism.getModelType().nondeterministic() && prism.getModelType().removeNondeterminism() != prism.getModelType()) {
            mainLog.printWarning("For simulation, nondeterminism in " + prism.getModelType() + " is resolved uniformly (resulting in " + prism.getModelType().removeNondeterminism() + ").");
        }

        // Check that properties are valid for this model type
        for (Expression expr : exprs)
            expr.checkValid(prism.getModelType().removeNondeterminism());

        List<State> states = initialStates;
        //Check if intitialStates is null or empty, get model initial states instead
        if (initialStates == null || initialStates.isEmpty()){
            states = project.getInitialStateObjects();
        }

        // Do simulation
        List<Result[]> resArrays = new ArrayList<>();

        for (State s : states){
            Result[] resArray;

            if (parallel){
                //Match simulation Method
                SimulationMethod simMethod = processSimulationOptions(exprs.get(0), simulationMethod);
                resArray = simulator.modelCheckMultipleProperties(propertiesFile, exprs, s, maxPathLength, simMethod);
            }else{
                resArray = new Result[exprs.size()];
                for (int i = 0; i < exprs.size(); i++){
                    //Match simulation Method
                    SimulationMethod simMethod = processSimulationOptions(exprs.get(i), simulationMethod);
                    Result res = simulator.modelCheckSingleProperty(propertiesFile, exprs.get(i), s, maxPathLength, simMethod);
                    resArray[i] = res;
                }
            }
            resArrays.add(resArray);
        }

        return resArrays;
    }

    private SimulationMethod processSimulationOptions(Expression expr, String simMethodName) throws PrismException
    {
        SimulationMethod aSimMethod = null;

        // See if property to be checked is a reward (R) operator
        boolean isReward = (expr instanceof ExpressionReward);

        // See if property to be checked is quantitative (=?)
        boolean isQuant = Expression.isQuantitative(expr);

        // Pick defaults for simulation settings
        double simApprox = prism.getSettings().getDouble(PrismSettings.SIMULATOR_DEFAULT_APPROX);
        double simConfidence = prism.getSettings().getDouble(PrismSettings.SIMULATOR_DEFAULT_CONFIDENCE);
        int simNumSamples = prism.getSettings().getInteger(PrismSettings.SIMULATOR_DEFAULT_NUM_SAMPLES);
        double simWidth = prism.getSettings().getDouble(PrismSettings.SIMULATOR_DEFAULT_WIDTH);

        int reqIterToConclude = prism.getSettings().getInteger(PrismSettings.SIMULATOR_DECIDE);
        double simMaxReward = prism.getSettings().getDouble(PrismSettings.SIMULATOR_MAX_REWARD);
        double simMaxPath = prism.getSettings().getLong(PrismSettings.SIMULATOR_DEFAULT_MAX_PATH);

        // Pick a default method, if not specified
        // (CI for quantitative, SPRT for bounded)
        if (simMethodName == null) {
            simMethodName = isQuant ? "ci" : "sprt";
        }

        // CI
        if (simMethodName.equals("ci")) {
            /*if (simWidthGiven && simConfidenceGiven && simNumSamplesGiven) {
                throw new PrismException("Cannot specify all three parameters (width/confidence/samples) for CI method");
            }
            if (!simWidthGiven) {
                // Default (unless width specified) is to leave width unknown
                aSimMethod = new CIwidth(simConfidence, simNumSamples);
            } else if (!simNumSamplesGiven) {
                // Next preferred option (unless specified) is unknown samples
                if (simManual)
                    aSimMethod = new CIiterations(simConfidence, simWidth, reqIterToConclude);
                else
                    aSimMethod = (isReward ? new CIiterations(simConfidence, simWidth, simMaxReward) : new CIiterations(simConfidence, simWidth));
            } else {*/
                // Otherwise confidence unknown
                aSimMethod = new CIconfidence(simWidth, simNumSamples);
            //}
            //if (simApproxGiven) {
            //    mainLog.printWarning("Option -simapprox is not used for the CI method and is being ignored");
            //}
        }
        // ACI
        else if (simMethodName.equals("aci")) {
            /*if (simWidthGiven && simConfidenceGiven && simNumSamplesGiven) {
                throw new PrismException("Cannot specify all three parameters (width/confidence/samples) for ACI method");
            }
            if (!simWidthGiven) {
                // Default (unless width specified) is to leave width unknown
                aSimMethod = new ACIwidth(simConfidence, simNumSamples);
            } else if (!simNumSamplesGiven) {
                // Next preferred option (unless specified) is unknown samples
                if (simManual)
                    aSimMethod = new ACIiterations(simConfidence, simWidth, reqIterToConclude);
                else
                    aSimMethod = (isReward ? new ACIiterations(simConfidence, simWidth, simMaxReward) : new CIiterations(simConfidence, simWidth));
            } else {*/
                // Otherwise confidence unknown
                aSimMethod = new ACIconfidence(simWidth, simNumSamples);
            /*}
            if (simApproxGiven) {
                mainLog.printWarning("Option -simapprox is not used for the ACI method and is being ignored");
            }*/
        }
        // APMC
        else if (simMethodName.equals("apmc")) {
            /*if (isReward) {
                throw new PrismException("Cannot use the APMC method on reward properties; try CI (switch -simci) instead");
            }
            if (simApproxGiven && simConfidenceGiven && simNumSamplesGiven) {
                throw new PrismException("Cannot specify all three parameters (approximation/confidence/samples) for APMC method");
            }
            if (!simApproxGiven) {
                // Default (unless width specified) is to leave approximation unknown
                aSimMethod = new APMCapproximation(simConfidence, simNumSamples);
            } else if (!simNumSamplesGiven) {
                // Next preferred option (unless specified) is unknown samples
                aSimMethod = new APMCiterations(simConfidence, simApprox);
            } else {*/
                // Otherwise confidence unknown
                aSimMethod = new APMCconfidence(simApprox, simNumSamples);
            /*}
            if (simWidthGiven) {
                mainLog.printWarning("Option -simwidth is not used for the APMC method and is being ignored");
            }*/
        }
        // SPRT
        else if (simMethodName.equals("sprt")) {
            if (isQuant) {
                throw new PrismException("Cannot use SPRT on a quantitative (=?) property");
            }
            aSimMethod = new SPRTMethod(simConfidence, simConfidence, simWidth);
            /*if (simApproxGiven) {
                mainLog.printWarning("Option -simapprox is not used for the SPRT method and is being ignored");
            }
            if (simNumSamplesGiven) {
                mainLog.printWarning("Option -simsamples is not used for the SPRT method and is being ignored");
            }*/
        } else
            throw new PrismException("Unknown simulation method \"" + simMethodName + "\"");

        return aSimMethod;
    }


}
