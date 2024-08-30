package prism.core;

import parser.VarList;
import parser.ast.Expression;
import parser.ast.ModulesFile;
import parser.ast.PropertiesFile;
import parser.type.Type;
import parser.type.TypeBool;
import parser.type.TypeDouble;
import parser.type.TypeInt;
import prism.*;
import prism.api.AP;
import prism.api.Graph;
import prism.api.State;
import prism.api.Transition;
import prism.core.Property.Property;
import prism.core.cluster.*;
import prism.db.Batch;
import prism.db.Database;
import prism.db.mappers.*;
import simulator.Choice;
import simulator.TransitionList;

import java.io.*;
import java.nio.file.Files;
import java.sql.SQLException;
import java.util.*;
import java.util.stream.Collectors;

/**
 * Representation of the model on the backend side. Contains Structural Information, Model Checker Access and Database Connection
 */
public class Model implements Namespace{

    private static final Type[] valueTypes = {TypeInt.getInstance(), TypeDouble.getInstance(), TypeBool.getInstance()};

    private final String id;

    private final ModulesFile modulesFile;

    private final Updater updater;

    private final Prism prism;

    private final Database database;
    //Name of the associated table for states in the database
    private final String TABLE_STATES;
    //Name of the associated table for transitions in the database
    private final String TABLE_TRANS;
    private final String TABLE_RES;
    public final boolean debug;
    private final String rootDir;
    private prism.Model prismModel;

    private final TreeMap<String, Object> info;

    //List of properties that have been model checked
    private final List<Property> properties;

    private final List<Cluster> clusters;

    private final Map<String, AP> APs;

    private final File outLog;

    public Model(String id, String rootDir, Database database, String cuddMaxMem, int numIterations, boolean debug) throws Exception {
        this.id = id;
        if (debug) this.prism = new Prism(new PrismPrintStreamLog(System.out));
        else this.prism = new Prism(new PrismDevNullLog());
        prism.setCUDDMaxMem(cuddMaxMem);
        prism.setEngine(1);
        prism.setMaxIters(numIterations);
        this.debug = debug;
        this.rootDir = rootDir;
        File file = new File(String.format("%s/%s/", rootDir, id) + PROJECT_MODEL);
        if (!file.exists()) throw new Exception("Model File does not exist");
        outLog =  new File(String.format("%s/%s/", rootDir, id) + LOG_FILE);
        Files.deleteIfExists(outLog.toPath());
        prism.initialise();
        prism.setStoreVector(true);
        try (Timer parse = new Timer("parsing model", outLog)){
            this.modulesFile = prism.parseModelFile(file, ModelType.MDP);
            prism.loadPRISMModel(this.modulesFile);
        } catch (FileNotFoundException e) {
            throw new Exception(e.getMessage());
        }

        this.updater = new Updater(modulesFile, prism);
        this.database = database;
        this.info = new TreeMap<>();

        TABLE_STATES = String.format(TABLE_STATES_GEN, 0);
        TABLE_TRANS = String.format(TABLE_TRANS_GEN, 0);
        TABLE_RES = String.format(TABLE_RES_GEN, 0);

        this.properties = new ArrayList<>();
        this.clusters = new ArrayList<>();

        this.APs = new HashMap<>();
        Map<String, Integer> usedShorts = new HashMap<>();
        Map<String, String> labelStyles = new HashMap<>();
        File styleFile = new File(String.format("%s/%s/", rootDir, id) + STYLE_FILE);
        if (styleFile.exists() && styleFile.isFile() ){
            try(BufferedReader read = new BufferedReader(new FileReader(styleFile))){
                labelStyles = read.lines().collect(Collectors.toMap(l -> l.split(":")[0], l -> l.split(":")[1]));
            }
        }

        AP initial;
        if (labelStyles.containsKey(LABEL_INIT)){
            initial = new AP(labelStyles.get(LABEL_INIT),true);
        }else{
            initial = new AP("i", false);
        }
        APs.put(LABEL_INIT,  initial);

        AP deadlock;
        if (labelStyles.containsKey(LABEL_DEAD)){
            deadlock = new AP(labelStyles.get(LABEL_DEAD),true);
        }else{
            deadlock = new AP("d", false);
        }
        APs.put(LABEL_DEAD,  deadlock);

        for (int i = 0; i < modulesFile.getNumLabels(); i++){
            String name = modulesFile.getLabelName(i);
            AP ap;
            if (labelStyles.containsKey(name)){
                ap = new AP(labelStyles.get(name),true);
            }else{
                String shortName = name.substring(0, 1);
                if (!usedShorts.containsKey(shortName)) usedShorts.put(shortName, 0);
                int number = usedShorts.get(shortName);
                ap = new AP(shortName + number, false);
                usedShorts.replace(shortName, number + 1);
            }
            APs.put(name,  ap);
        }
        info.put("ID", id);
        info.put(OUTPUT_LABELS, APs);

        info.put(OUTPUT_RESULTS, modelCheckAll());

        System.out.printf("Project %s opened\n", id);
        if (debug){
            System.out.println("----------Times----------");
            try (BufferedReader br = new BufferedReader(new FileReader(outLog))) {
                String line;
                while ((line = br.readLine()) != null) {
                    System.out.println(line);
                }
            }
            System.out.println("-----------End-----------");
        }

    }

    public void printScheduler(String pathName) throws Exception {
        modelCheckAll();
        int i = 0;
        for (Property p : properties){
            p.printScheduler(String.format("%s/sched_%s.csv", pathName, i));
            i++;
        }
    }

    //Generic Getter
    public String getID() {
        return id;
    }

    public ModulesFile getModulesFile() {
        return modulesFile;
    }

    public String getPath() {
        return this.rootDir;
    }

    public Updater getUpdater() {
        return updater;
    }

    public Prism getPrism() {
        return this.prism;
    }

    public Database getDatabase() {
        return this.database;
    }

    // internal functionality

    public String getStateTableName() {
        return TABLE_STATES;
    }

    public String getTransitionTableName() {
        return TABLE_TRANS;
    }

    public String getInfoTableName() {
        return TABLE_RES;
    }

    public boolean isBuilt() {
        return (database.question(String.format("SELECT name FROM sqlite_schema WHERE type='table' AND name='%s'", TABLE_STATES)) & database.question(String.format("SELECT name FROM sqlite_schema WHERE type='table' AND name='%s'", TABLE_TRANS)));
    }

    public boolean existsProperty(String name) {
        return properties.stream().anyMatch(p -> p.getName().equals(name));
    }

    public Optional<Property> getProperty(String name) {
        return properties.stream().filter(p -> p.getName().equals(name)).findFirst();
    }

    public String newProperty(PropertiesFile propertiesFile, int number) {
        parser.ast.Property prismProperty = propertiesFile.getPropertyObject(number);
        String name = prismProperty.getName() != null ? prismProperty.getName() : prismProperty.getExpression().toString();
        if (existsProperty(name)) return name;
        properties.add(Property.createProperty(this, properties.size(), propertiesFile, prismProperty));
        return name;
    }

    public Map<Long, Double> getPropertyMap(String propertyName) {
        if (!existsProperty(propertyName)) return null;
        List<Pair<Long, Double>> list = database.executeCollectionQuery(String.format("SELECT %s, %s FROM %s", ENTRY_S_ID, propertyName, TABLE_STATES), new EntryMapper(propertyName));
        Map<Long, Double> out = new HashMap<>();
        for (Pair<Long, Double> p : list){
            out.put(p.getKey(), p.getValue());
        }
        return out;
    }

    public String normalizeStateName(String stateDescription) {
        String intern = stateDescription.replace(" ", "");

        // Remove parentheses if necessary
        if (intern.startsWith("(")) {
            intern = stateDescription.substring(1, stateDescription.length() - 1);
        }

        //Replace , by ;
        if (!intern.contains(";")) {
            intern = intern.replace(",", ";");
        }

        try {
            if (stateDescription.contains("=")) {
                String[] ids = intern.split(";");
                String[] ordered = new String[ids.length];
                VarList v  = modulesFile.createVarList();

                for (String id : ids) {
                    String[] assignment = id.split("=");
                    if (assignment.length != 2) {
                        throw new RuntimeException("Invalid assignment: " + id);
                    }
                    int loc = v.getIndex(assignment[0]);
                    ordered[loc] = assignment[1];
                }
                StringBuilder out = null;
                for (String o : ordered) {
                    if (out == null) {
                        out = new StringBuilder();
                    } else {
                        out.append(";");
                    }
                    out.append(o);
                }
                intern = (out == null ? null : out.toString());
            }
        } catch (PrismException e) {
            throw new RuntimeException(e);
        }
        return intern;
    }

    public parser.State parseState(String stringValues) throws PrismLangException {
        String intern = stringValues;

        // Remove parentheses if necessary
        if (intern.startsWith("(")) {
            intern = stringValues.substring(1, stringValues.length() - 1);
        }

        //Replace , by ;
        if (!intern.contains(";")) {
            intern = intern.replace(",", ";");
        }

        //Construct Prism State manually , Prism internal function slightly broken
        String[] ids = intern.split(";");
        parser.State state = new parser.State(ids.length);

        if (!stringValues.contains("=")) {
            //Assignment per order
            int i = 0;
            for (String id : ids) {
                String assignment = id.strip();
                Object value = null;
                for (Type t : valueTypes) {
                    try {
                        value = castStringToType(assignment, t);
                        break;
                    } catch (PrismLangException e) {
                        value = null;
                    }
                }
                if (value == null) {
                    System.out.println(id);
                    throw new PrismLangException("Invalid value: " + id);
                }
                state.setValue(i, value);
                i++;
            }
        } else {
            //Direct Assignment
            for (String id : ids) {
                String[] assignment = id.split("=");
                if (assignment.length != 2) {
                    throw new PrismLangException("Invalid assignment: " + id);
                }
                Object value = null;
                for (Type t : valueTypes) {
                    try {
                        value = castStringToType(assignment[1], t);
                        break;
                    } catch (PrismLangException | NumberFormatException e) {
                        value = null;
                    }
                }
                if (value == null) {
                    throw new PrismLangException("Invalid value in: " + id);
                }
                state.setValue(modulesFile.getVarIndex(assignment[0]), value);
            }
        }
        return state;
    }

    public Map<String, Object> parseParameters(String stringValues) throws PrismLangException {
        parser.State state = parseState(stringValues);
        Map<String, Object> params = new HashMap<>();
        for (int i = 0; i < state.varValues.length; i++) {
            params.put(modulesFile.getVarName(i), state.varValues[i]);
        }
        return params;
    }

    public static Object castStringToType(String s, Type t) throws PrismLangException {
        switch (t.getTypeString()) {
            case "int":
                return t.castValueTo(Integer.valueOf(s));
            case "double":
                return t.castValueTo(Double.valueOf(s));
            case "bool":
                return t.castValueTo(Boolean.valueOf(s));
        }
        throw new PrismLangException("Unknown Type");
    }

    public Expression parseSingleExpressionString(String expression) throws PrismLangException {
        return Prism.parseSingleExpressionString(expression);
    }

    public Map<String, PropertiesFile> propertyFileMap() throws PrismLangException, FileNotFoundException {
        Map<String, PropertiesFile> out = new HashMap<>();
        for (File file : Objects.requireNonNull(new File(String.format("%s/%s", rootDir, id)).listFiles())) {
            if (!Namespace.FILES_RESERVED.contains(file.getName())) {
                PropertiesFile propertiesFile = prism.parsePropertiesFile(file);
                for (int i = 0; i < propertiesFile.getNumProperties(); i++) {
                    String name = propertiesFile.getPropertyName(i);
                    out.put(name, propertiesFile);
                }
            }
        }
        return out;
    }

    // access to Structural Information

    public Long getDefaultInitialState() throws Exception {
        if (modulesFile.getInitialStates() != null) {
            return getInitialStates().get(0);
        }
        return getStateID(modulesFile.getDefaultInitialState().toString(this.modulesFile));
    }

    public List<Long> getInitialStates() throws Exception {
        List<Long> initials = new ArrayList<>();

        if (modulesFile.getInitialStates() != null) {
            Expression initialExpression = modulesFile.getInitialStates();
            for (parser.State state : modulesFile.createVarList().getAllStates()) {
                if (initialExpression.evaluateBoolean(state)) {
                    initials.add(getStateID(state.toString(modulesFile)));
                }
            }
        } else {
            initials.add(this.getDefaultInitialState());
        }

        return initials;
    }

    public List<Long> getStatesByExpression(String expression) {
        List<Long> members = new ArrayList<>();
        if (modulesFile.getLabelList().getLabelNames().contains(expression)) {
            for (String stateDescription : this.prismModel.getReachableStates().exportToStringList()) {
                try {
                    long id = this.getStateID(stateDescription);
                    BaseState state = new BaseState(id, stateDescription, this);
                    if (state.getLabels().contains(expression)) {
                        members.add(id);
                    }
                } catch (Exception e) {
                    throw new RuntimeException(e);
                }
            }
            return members;
        }
        for (String stateDescription : this.prismModel.getReachableStates().exportToStringList()) {
            try {
                long id = this.getStateID(stateDescription);
                BaseState state = new BaseState(id, stateDescription, this);
                if (state.checkForProperty(expression)) {
                    members.add(id);
                }
            } catch (prism.PrismLangException e) {
                throw new RuntimeException(e);
            }
        }
        return members;
    }

    // access to Model Checker
    public void buildModel() throws PrismException{
        try(Timer build = new Timer("Build Model", this.outLog)) {
            prism.buildModelIfRequired();
        } catch (Exception e) {
            throw new RuntimeException(e);
        }
        this.prismModel = prism.getBuiltModel();
        this.info.put("States", prismModel.getNumStatesString());
        this.info.put("Transitions", prismModel.getNumTransitionsString());
        if (prismModel == null) {
            return;
        }
        if (!this.isBuilt()) {
            try(Timer build = new Timer("Build Database", this.outLog)){
                int numRewards = modulesFile.getNumRewardStructs();
                try {
                    database.execute(String.format("CREATE TABLE %s (%s INTEGER PRIMARY KEY NOT NULL, %s TEXT, %s BOOLEAN)", TABLE_STATES, ENTRY_S_ID, ENTRY_S_NAME, ENTRY_S_INIT));
                    database.execute(String.format("CREATE TABLE %s (%s INTEGER PRIMARY KEY, %s INTEGER NOT NULL, %s TEXT, %s INTEGER);", TABLE_TRANS, ENTRY_T_ID, ENTRY_T_OUT, ENTRY_T_ACT, ENTRY_T_PROB));
                    database.execute(String.format("CREATE TABLE %s (%s TEXT, %s TEXT, %s TEXT)", TABLE_RES, ENTRY_R_ID, ENTRY_R_NAME, ENTRY_R_INFO));

                    for (int i = 0; i < numRewards; i++){
                        database.execute(String.format("ALTER TABLE %s ADD COLUMN %s TEXT", TABLE_STATES, ENTRY_REW + i));
                        database.execute(String.format("ALTER TABLE %s ADD COLUMN %s TEXT", TABLE_TRANS, ENTRY_REW + i));
                    }

                    } catch (SQLException e) {
                    throw new RuntimeException(e.toString());
                }

                List<String> stateList = this.prismModel.getReachableStates().exportToStringList();
                Map<parser.State, Integer> states = new HashMap<>();

                String stateInsertCall = String.format("INSERT INTO %s (%s,%s,%s) VALUES(?,?,?)", TABLE_STATES, ENTRY_S_ID, ENTRY_S_NAME, ENTRY_S_INIT);
                String transitionInsertCall = String.format("INSERT INTO %s(%s,%s,%s) VALUES (?,?,?)", TABLE_TRANS, ENTRY_T_OUT, ENTRY_T_ACT, ENTRY_T_PROB);
                if (numRewards > 0){
                    String[] rewardHeader = new String[numRewards];
                    String[] questionHeader = new String[numRewards];
                    for (int i=0; i < numRewards; i++){
                        rewardHeader[i] = ENTRY_REW + i;
                        questionHeader[i] = "?";
                    }
                    stateInsertCall = String.format("INSERT INTO %s (%s,%s,%s,%s) VALUES(?,?,?,%s)", TABLE_STATES, ENTRY_S_ID, ENTRY_S_NAME, ENTRY_S_INIT, String.join(",", rewardHeader), String.join(",", questionHeader));
                    transitionInsertCall = String.format("INSERT INTO %s(%s,%s,%s,%s) VALUES (?,?,?,%s)", TABLE_TRANS, ENTRY_T_OUT, ENTRY_T_ACT, ENTRY_T_PROB, String.join(",", rewardHeader), String.join(",",questionHeader));
                }

                try(Batch toExecute = database.createBatch(stateInsertCall, 3 + numRewards)){
                    for (int i = 0; i < stateList.size(); i++) {
                        String stateName = normalizeStateName(stateList.get(i));
                        parser.State s = parseState(stateName);

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

                try(Batch toExecute = database.createBatch(transitionInsertCall, 3 + numRewards)) {
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
            String name = newProperty(propertiesFile, i);
            Optional<Property> p = getProperty(name);
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

    public TreeMap<String, String> modelCheckAll() throws Exception {
        TreeMap<String, String> info = null;
        for (File file : Objects.requireNonNull(new File(String.format("%s/%s", rootDir, id)).listFiles())) {
            if (!Namespace.FILES_RESERVED.contains(file.getName())) {
                if (info == null){
                    info = modelCheckingFromFile(file.getPath());
                }else{
                    for (Map.Entry<String, String> e : modelCheckingFromFile(file.getPath()).entrySet()){
                        info.putIfAbsent(e.getKey(), e.getValue());
                    }
                }

            }
        }
        if (this.debug) {
            System.out.printf("Model Checking in Project %s finished%n", id);
        }
        return info;
    }

    // access to database

    public long getStateID(String stateDescription) {
        String stateName = normalizeStateName(stateDescription);
        Optional<Long> results = database.executeLookupQuery(String.format("SELECT %s FROM %s WHERE %s = '%s';", ENTRY_S_ID, TABLE_STATES, ENTRY_S_NAME, stateName), Long.class);
        if (results.isEmpty()) return -1;
        return results.get();
    }

    public String getStateName(long stateID) {
        Optional<String> results = database.executeLookupQuery(String.format("SELECT %s FROM %s WHERE %s = '%s';", ENTRY_S_NAME, TABLE_STATES, ENTRY_S_ID, stateID), String.class);
        if (results.isEmpty()) return null;
        return results.get();
    }

    public List<Long> getAllStates() {
        return database.executeCollectionQuery(String.format("SELECT %s FROM %s", ENTRY_S_ID, TABLE_STATES), Long.class);
    }

    public List<State> getStates(List<Long> stateIDs) {
        String stateString = stateIDs.stream().map(l -> Long.toString(l)).collect(Collectors.joining(","));
        return database.executeCollectionQuery(String.format("SELECT * FROM %s WHERE %s in (%s)", TABLE_STATES, ENTRY_S_ID, stateString), new StateMapper(this, null));
    }

    public List<Transition> getOutgoingList(long stateID) {
        return database.executeCollectionQuery(String.format("SELECT * FROM %s WHERE %s == %s ", TABLE_TRANS, ENTRY_T_OUT, stateID), new TransitionMapper(this));

    }

    /*
    public List<Transition> getIncomingList(long stateID) {
        return database.executeCollectionQuery(String.format("SELECT *, GROUP_CONCAT(%s || ':' || %s, ';') as %s FROM %s WHERE %s == %s GROUP BY %s, %s",ENTRY_T_IN, ENTRY_T_PROB, ENTRY_T_MAP, TABLE_TRANS, ENTRY_T_IN, stateID, ENTRY_T_OUT, ENTRY_T_ACT), new TransitionMapper());
    }*/

    public List<Transition> getAllTransitions() {
        return database.executeCollectionQuery(String.format("SELECT * FROM %s", TABLE_TRANS), new TransitionMapper(this));
    }

    // output Functions
    public Graph getInitialNodes() {
        try {
            List<State> initials = database.executeCollectionQuery(String.format("SELECT * FROM %s WHERE %s = 1", TABLE_STATES, ENTRY_S_INIT), new StateMapper(this, null));

            return new Graph(this, initials, new ArrayList<>());
        } catch (Exception e) {
            throw new RuntimeException(e);
        }
    }

    public Graph getInitialNodes(List<Integer> clusterIDs) {
        if (clusterIDs == null || clusterIDs.isEmpty()) return this.getInitialNodes();
        try {
            List<Cluster> clusters = this.getClusters(clusterIDs);
            StringBuilder identifier = null;
            StringBuilder group = null;
            for (Cluster c : clusters){
                if (identifier == null){
                    identifier = new StringBuilder();
                    group = new StringBuilder();
                }else{
                    identifier.append(" || ");
                    group.append(", ");
                }
                identifier.append(c.getCollumn());
                group.append(c.getCollumn());
            }

            List<State> initials = database.executeCollectionQuery(String.format("SELECT %s as %s, GROUP_CONCAT(%s,';') AS %s FROM %s WHERE %s = 1 GROUP BY %s", identifier.toString(), ENTRY_C_NAME, ENTRY_S_ID, ENTRY_C_SUB, TABLE_STATES, ENTRY_S_INIT, group.toString()), new StateMapper(this, clusters));

            return new Graph(this, initials, new ArrayList<>());
        } catch (Exception e) {
            throw new RuntimeException(e);
        }
    }

    public Graph getGraph(int schedulerID) {
        List<State> states = database.executeCollectionQuery(String.format("SELECT * FROM %s", TABLE_STATES), new StateMapper(this, null));
        List<Transition> transitions = database.executeCollectionQuery(String.format("SELECT * FROM %s", TABLE_TRANS), new TransitionMapper(this));
        return new Graph(this, states, transitions);
    }

    public Graph getGraph(int schedulerID, List<Integer> clusterIDs) {
        if (clusterIDs == null || clusterIDs.isEmpty()) return this.getGraph(schedulerID);

        try {
            List<Cluster> clusters = this.getClusters(clusterIDs);
            StringBuilder identifierStates = null;
            StringBuilder groupStates = null;
            for (Cluster c : clusters){
                if (identifierStates == null){
                    identifierStates = new StringBuilder();
                    groupStates = new StringBuilder();
                }else{
                    identifierStates.append(" || ");
                    groupStates.append(", ");
                }
                identifierStates.append(c.getCollumn());
                groupStates.append(String.format(c.getCollumn()));
            }

            List<State> states = database.executeCollectionQuery(String.format("SELECT %s as %s, GROUP_CONCAT(%s,';') AS %s FROM %s GROUP BY %s", identifierStates, ENTRY_C_NAME, ENTRY_S_ID, ENTRY_C_SUB, TABLE_STATES, groupStates), new StateMapper(this, clusters));

            Map<Long, String> reverseCluster = database.executeCollectionQuery(String.format("SELECT %s, %s AS %s FROM %s", ENTRY_S_ID, identifierStates, ENTRY_C_NAME, TABLE_STATES), new PairMapper<>(ENTRY_S_ID, ENTRY_C_NAME, Long.class, String.class)).stream().collect(Collectors.toMap(Pair::getKey, Pair::getValue));

            List<Transition> transitions = database.executeCollectionQuery(String.format("SELECT min(%s) AS %s, %s AS %s, %s, GROUP_CONCAT(%s,';') AS %s FROM %s JOIN %s ON %s = %s GROUP BY %s, %s", ENTRY_T_ID, ENTRY_T_ID, identifierStates, ENTRY_T_OUT, ENTRY_T_ACT, ENTRY_T_PROB, ENTRY_T_PROB, TABLE_TRANS, TABLE_STATES, ENTRY_S_ID, ENTRY_T_OUT, groupStates, ENTRY_T_ACT), new TransitionMapper(this, clusters, reverseCluster));
            return new Graph(this, states, transitions);
        }catch (Exception e){
            throw new RuntimeException(e);
        }
    }

    public Graph getState(long stateID) {
        Optional<State> results = database.executeLookupQuery(String.format("SELECT * FROM %s WHERE %s = %s", TABLE_STATES, ENTRY_S_ID, stateID), new StateMapper(this, null));
        if (results.isEmpty()) return null;
        List<State> states = new ArrayList<>();
        states.add(results.get());
        return new Graph(this, states, new ArrayList<>());
    }

    public Graph getOutgoing(List<Long> stateIDs, int schedulerID) {
        String stateID = stateIDs.stream().map(l -> Long.toString(l)).collect(Collectors.joining(","));
        List<Transition> transitions = database.executeCollectionQuery(String.format("SELECT * FROM %s WHERE %s IN (%s)", TABLE_TRANS, ENTRY_T_OUT, stateID), new TransitionMapper(this));
        Set<String> statesOfInterest = new HashSet<>();
        for (Transition t : transitions) {
            statesOfInterest.add(t.getSource());
            statesOfInterest.addAll(new ArrayList<>(t.getProbabilityDistribution().keySet()));
        }
        String stateString = String.join(",", statesOfInterest);
        List<State> states = database.executeCollectionQuery(String.format("SELECT * FROM %s WHERE %s in (%s)", TABLE_STATES, ENTRY_S_ID, stateString), new StateMapper(this, null));
        return new Graph(this, states, transitions);
    }

    public Graph getOutgoing(List<Long> stateIDs, int schedulerID, List<Integer> clusterIDs) {
        if (clusterIDs == null || clusterIDs.isEmpty()) return this.getOutgoing(stateIDs, schedulerID);

        try{
            List<Cluster> clusters = this.getClusters(clusterIDs);
            StringBuilder identifierStates = null;
            StringBuilder groupStates = null;
            for (Cluster c : clusters){
                if (identifierStates == null){
                    identifierStates = new StringBuilder();
                    groupStates = new StringBuilder();
                }else{
                    identifierStates.append(" || ");
                    groupStates.append(", ");
                }
                identifierStates.append(c.getCollumn());
                groupStates.append(c.getCollumn());
            }

            Map<Long, String> reverseCluster = database.executeCollectionQuery(String.format("SELECT %s, %s AS %s FROM %s", ENTRY_S_ID, identifierStates, ENTRY_C_NAME, TABLE_STATES), new PairMapper<>(ENTRY_S_ID, ENTRY_C_NAME, Long.class, String.class)).stream().collect(Collectors.toMap(Pair::getKey, Pair::getValue));

            String stateID = stateIDs.stream().map(l -> Long.toString(l)).collect(Collectors.joining(","));

            List<Transition> transitions = database.executeCollectionQuery(String.format("SELECT min(%s) AS %s, %s AS %s, %s, GROUP_CONCAT(%s,';') AS %s FROM %s JOIN %s ON %s = %s WHERE %s IN (%s) GROUP BY %s, %s", ENTRY_T_ID, ENTRY_T_ID, identifierStates, ENTRY_T_OUT, ENTRY_T_ACT, ENTRY_T_PROB, ENTRY_T_PROB , TABLE_TRANS, TABLE_STATES, ENTRY_S_ID, ENTRY_T_OUT ,ENTRY_T_OUT, stateID, groupStates, ENTRY_T_ACT), new TransitionMapper(this, clusters, reverseCluster));

            Set<String> statesOfInterest = new HashSet<>();
            for (Transition t : transitions) {
                statesOfInterest.add(t.getSource());
                statesOfInterest.addAll(new ArrayList<>(t.getProbabilityDistribution().keySet()));
            }
            String stateString = statesOfInterest.stream().map(s -> String.format("'%s'", s)).collect(Collectors.joining(","));

            List<State> states = database.executeCollectionQuery(String.format("SELECT %s as %s, GROUP_CONCAT(%s,';') AS %s FROM %s WHERE %s IN (%s) GROUP BY %s", identifierStates, ENTRY_C_NAME, ENTRY_S_ID, ENTRY_C_SUB, TABLE_STATES, ENTRY_C_NAME, stateString, groupStates), new StateMapper(this, clusters));
            return new Graph(this, states, transitions);
        }catch (Exception e){
            throw new RuntimeException(e);
        }
    }

    /*
    public Graph getIncoming(long stateID) {
        List<State> states = database.executeCollectionQuery(String.format("SELECT %s.* FROM %s LEFT JOIN %s ON %s.%s = %s.%s WHERE %s.%s = %s OR %s.%s = %s", TABLE_STATES, TABLE_STATES, TABLE_TRANS, TABLE_STATES, ENTRY_S_ID, TABLE_TRANS, ENTRY_T_OUT, TABLE_TRANS, ENTRY_T_IN, stateID, TABLE_STATES, ENTRY_S_ID, stateID), new StateMapper(parent,0));
        List<Transition> transitions = database.executeCollectionQuery(String.format("SELECT *, GROUP_CONCAT(%s || ':' || %s, ';') as %s FROM %s WHERE %s == %s GROUP BY %s, %s",ENTRY_T_IN, ENTRY_T_PROB, ENTRY_T_MAP, TABLE_TRANS, ENTRY_T_IN, stateID, ENTRY_T_OUT, ENTRY_T_ACT), new TransitionMapper());
        return new Graph(states, transitions);
    }*/

    // Clusters

    public String createCluster(ClusterType type, List<String> parameters){
        int clusterID = clusters.size();
        switch (type){
            case APCluster:
                if (clusters.stream().anyMatch(c -> c.getType().equals(type))) return "APCluster already exists";
                clusters.add(new APCluster(this, clusterID));
                break;
            case DistanceCluster:
                if (parameters.size()!=2) return "need 2 parameters (expression of target states, and granularity of cluster)";
                String expression = parameters.get(0);
                long granularity = Long.parseLong(parameters.get(1));
                if (clusters.stream().filter(c -> c.getType().equals(type)).anyMatch(c -> ((DistanceCluster) c).match(expression, granularity) )) return "DistanceCluster with these parameters already exists";
                clusters.add(new DistanceCluster(this, clusterID, expression, granularity, DistanceCluster.DistanceDirection.FORWARD));
                break;
            case PropertyCluster:
                if (parameters.size()!=2) return "need 2 parameters (property name, and granularity of cluster)";
                String propertyName = parameters.get(0);
                double granularity2 = Double.parseDouble(parameters.get(1));
                if (clusters.stream().filter(c -> c.getType().equals(type)).anyMatch(c -> ((PropertyCluster) c).match(propertyName, granularity2) )) return "PropertyCluster  with these parameters already exists";
                clusters.add(new PropertyCluster(this, clusterID, propertyName, granularity2));
                break;
            default:
                return "No fitting ClusterType found";

        }
        clusters.get(clusterID).buildCluster();
        return String.format("Created Cluster with id %s", clusterID);

    }

    public List<Cluster> getClusters(List<Integer> ids){
        List<Cluster> output = new ArrayList<>();
        for (int id : ids) {
            if (id >= clusters.size()) throw new RuntimeException(String.format("id %s not found", id));
            output.add(clusters.get(id));
        }
        return output;
    }

    public List<Property> getProperties() {
        return this.properties;
    }

    public List<String> getLabels(parser.State state) throws Exception {
        List<String> labels = new ArrayList<>();
        if (isInitial(state)) labels.add(LABEL_INIT);
        if (isDeadlocked(state)) labels.add(LABEL_DEAD);
        for (int i = 0; i < modulesFile.getLabelList().size(); i++){
            if (modulesFile.getLabelList().getLabel(i).evaluateBoolean(modulesFile.getConstantValues(), state)){
                labels.add(modulesFile.getLabelName(i));
            }
        }
        return labels;
    }

    private boolean isDeadlocked(parser.State state) throws PrismException {
        TransitionList<Double> transitionList = new TransitionList<>(Evaluator.forDouble());
        updater.calculateTransitions(state, transitionList);
        return transitionList.isDeadlock();
    }

    private boolean isInitial(parser.State state) throws PrismLangException {
        if (modulesFile.getInitialStates() != null) {
            return modulesFile.getInitialStates().evaluateBoolean(modulesFile.getConstantValues(), state);
        } else {
            return modulesFile.getDefaultInitialState().equals(state);
        }
    }

    public TreeMap<String, AP> getLabelMap(parser.State state) throws Exception {
        TreeMap<String, AP> labels = new TreeMap<>();
        labels.put(LABEL_INIT, isInitial(state)?APs.get(LABEL_INIT): null);
        labels.put(LABEL_DEAD, isDeadlocked(state)?APs.get(LABEL_DEAD): null);
        for (int i = 0; i < modulesFile.getLabelList().size(); i++){
            String name = modulesFile.getLabelName(i);
            labels.put(name, modulesFile.getLabelList().getLabel(i).evaluateBoolean(modulesFile.getConstantValues(), state) ? APs.get(name) : null);
        }
        return labels;
    }

    public TreeMap<String, Object> getInformation() {
        return this.info;
    }

    public void removeFiles() throws Exception {
        File directory = new File(String.format("%s/%s", rootDir, id));
        if (directory.exists()) {
            for (File file : Objects.requireNonNull(directory.listFiles())) {
                file.delete();
            }
            directory.delete();
        }
    }

    public long getSize() {
        return this.prismModel.getNumStates();
    }

    public File getLog(){
        return this.outLog;
    }
}
