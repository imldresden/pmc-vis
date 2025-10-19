package prism.core.View;

import org.jgrapht.Graph;
import org.jgrapht.graph.AsSubgraph;
import prism.core.Namespace;
import prism.core.Project;
import prism.core.mdpgraph.MdpGraph;
import prism.misc.TimeSaver;
import prism.misc.Timer;

import java.io.File;
import java.lang.invoke.MethodType;
import java.lang.reflect.Field;
import java.util.*;

/**
 * Class used as parent of all model abstractions implemented. Contains the definition for all utility functions
 *
 * Single Abstractions only need to define the buildProject() function, that describes how the abstraction exactly works.
 */
public abstract class View implements Namespace {

    protected final ViewType type;

    protected final Project model;

    protected long id; // not final because of removal etc

    protected final long dbColumnId = id; // USE IN getColumn() (for removal etc)

    protected Map<String,Set<String>> stateRestriction = new HashMap<>();
    // stores the restriction used to determine the set of relevantStates
    // might be obsolete
    // implemented for the option of changing the set of relevant states at later execution time

    boolean relevantStatesAreProperSubset = false;

    protected Set<Long> relevantStates; // default: all states (in each Constructor of this views!)
    // states that a views will be created on
    // all other states will receive the non grouping Symbol

    // TODO create boolean isBinaryView, String hasString, String hasNotString for invertView

    protected boolean isActive = true;

    public void grpFctTester() {
        try (Timer timerGroupingFunction = new Timer(tsGrpFct)) {
            groupingFunction();
        } catch (Exception e) {

        }
    }

    protected enum BinaryMode {SHOW, HIDE}
    // HIDE: Group states that have the property -> HIDE states with property in a single one
    // SHOW: DON'T group states that have the property -> SHOW states with that property

    protected BinaryMode binaryMode = BinaryMode.SHOW; // intention: filter/find/show
    // not used in every views, but only ones that are truly binary or contain a truly binary version

    protected boolean semiGrouping = true;
    // relevant when binaryMode == HIDE (otherwise irrelevant)
    // true: remaining states without property grouped
    // false: remaining states without property NOT grouped

    protected Map<String, Object> attributes = new LinkedHashMap<>();
    // I/O: output current attributes values
    // maintained by setAttributes and assertAttributes

    private TimeSaver tsGrpFct;

    private TimeSaver tsBuild;
    private TimeSaver tsRequirements;

    private TimeSaver tsColumn;

    private TimeSaver tsExecuteBatch;

    private Map<String,TimeSaver> timeSaverMap;

    private String pathToFile = "/home/martin/Desktop/" + getCollumn() + ".txt";


    public View(Project parent, ViewType type, long id) {
        this.type = type;
        this.model = parent;
        timeSaverMap = new HashMap<>();
        tsBuild = new TimeSaver("Build Time", model.getID(), getType().name(), new File(pathToFile));
        tsRequirements = new TimeSaver("Checking Requirements Time", model.getID(), getType().name(), new File(pathToFile));
        tsColumn = new TimeSaver("Create Column Time", model.getID(), getType().name(), new File(pathToFile));
        tsGrpFct = new TimeSaver("Grouping Function Time", model.getID(), getType().name(), new File(pathToFile));
        tsExecuteBatch = new TimeSaver("Execute Batch Time", model.getID(), getType().name(), new File(pathToFile));
//        timeSaverMap.put("tsBuild", tsBuild);
//        timeSaverMap.put("tsRequirements", tsRequirements);
//        timeSaverMap.put("tsColumn", tsColumn);
//        timeSaverMap.put("tsGrpFct", tsGrpFct);
//        timeSaverMap.put("tsExecuteBatch", tsGrpFct);
        //if (model.getMdpGraph() == null) model.buildMdpGraph();
        //this.relevantStates = model.getMdpGraph().stateSet();
        this.id = id;
        attributes.put("ID", id);
        attributes.put("isactive", isActive);
        attributes.put("binmode", binaryMode); // TODO only put if isBinaryView
        attributes.put("semigrouping", semiGrouping);
        attributes.put("relevantStatesAreProperSubset", relevantStatesAreProperSubset);
        attributes.put("relevantstates", relevantStatesAreProperSubset ? relevantStates : "not displayed");
    }

    public View(Project parent, ViewType type, long id, Collection<String> attributeSetter) throws Exception {
        this.type = type;
        this.model = parent;
        tsBuild = new TimeSaver("Build Time", model.getID(), getType().name(), new File(pathToFile));
        tsRequirements = new TimeSaver("Checking Requirements Time", model.getID(), getType().name(), new File(pathToFile));
        tsColumn = new TimeSaver("Create Column Time", model.getID(), getType().name(), new File(pathToFile));
        tsGrpFct = new TimeSaver("Grouping Function Time", model.getID(), getType().name(), new File(pathToFile));
        tsExecuteBatch = new TimeSaver("Execute Batch Time", model.getID(), getType().name(), new File(pathToFile));
        //if (model.getMdpGraph() == null) model.buildMdpGraph();
        //this.relevantStates = model.getMdpGraph().stateSet();
        this.id = id;
        attributes.put("ID", id);
        attributes.put("isactive", isActive);
        attributes.put("binmode", binaryMode); // TODO "not displayed" if not isBinaryView
        attributes.put("semigrouping", semiGrouping);
        attributes.put("relevantStatesAreProperSubset", relevantStatesAreProperSubset);
        attributes.put("relevantstates", relevantStatesAreProperSubset ? relevantStates : "not displayed");
        attributes.putAll(setAttributes(attributeSetter));
    }

    public View(Project parent, ViewType type, long id, boolean semiGrouping) {
        this.type = type;
        this.model = parent;
        tsBuild = new TimeSaver("Build Time", model.getID(), getType().name(), new File(pathToFile));
        tsRequirements = new TimeSaver("Checking Requirements Time", model.getID(), getType().name(), new File(pathToFile));
        tsColumn = new TimeSaver("Create Column Time", model.getID(), getType().name(), new File(pathToFile));
        tsGrpFct = new TimeSaver("Grouping Function Time", model.getID(), getType().name(), new File(pathToFile));
        tsExecuteBatch = new TimeSaver("Execute Batch Time", model.getID(), getType().name(), new File(pathToFile));
        //if (model.getMdpGraph() == null) model.buildMdpGraph();
        //this.relevantStates = model.getMdpGraph().stateSet();
        this.id = id;
        this.semiGrouping = semiGrouping;
        attributes.put("ID", id);
        attributes.put("semigrouping", semiGrouping);
        attributes.put("relevantStatesAreProperSubset", relevantStatesAreProperSubset);
        attributes.put("relevantstates", relevantStatesAreProperSubset ? relevantStates : "not displayed");
    }

    public void buildView() throws Exception{
        if (isBuilt()) return;
        try (Timer timerBuild = new Timer(tsBuild)) {
            if (model.debug) System.out.println("######################################1");

            // 1. View specific checks
            try (Timer checkRequirements = new Timer(tsRequirements)) {
                if (!viewRequirementsFulfilled() || !isActive) {
                    return;
                }
            }
            if (model.debug) System.out.println("######################################2");

            // 2. Create new Column         "       "
            try (Timer createColumn = new Timer(tsColumn)) {
                //model.getDatabase().execute(String.format("ALTER TABLE %s ADD COLUMN %s TEXT DEFAULT %s", model.getStateTableName(), getCollumn(), Namespace.ENTRY_C_BLANK));
            }
            if (model.debug) System.out.println("######################################3");

            // 3. Compute grouping function mappings (saved as SQL statements)
            List<String> toExecute;
            try (Timer timerGroupingFunction = new Timer(tsGrpFct)) {
                toExecute = groupingFunction();
            }

            if (model.debug) System.out.println("######################################4");

            // 4. Write mapping to database (i.e. execute created SQL statements)
            try (Timer executeBatch = new Timer(tsExecuteBatch)) {
                if (!toExecute.isEmpty() || !model.debug) {
                    model.getDatabase().executeBatch(toExecute);
                } else {
                    throw new Exception("toExecute was empty!");
                }
            }
            if (model.debug) System.out.println("######################################5");
        }

        System.out.println("\n\nFinished\n\n");
    }

    protected abstract List<String> groupingFunction() throws Exception;// {return new ArrayList<>();} // chould be Abstract
    // function that performs the logical part of buildView()
    // returns list of sql statements that write the assigned value to the database

    protected boolean isBuilt(){
        return true;//return model.getDatabase().question(String.format("SELECT * FROM pragma_table_info('%s') WHERE name='%s'\n", model.getStateTableName(), getCollumn()));
    }

    public ViewType getType() {
        return type;
    }

    public long getId() {
        return this.id;
    }

    public void setId(long id) {
        this.id = id;
    }
    public abstract String getCollumn();

    // parses boolean as I want it and should be available in all views
    protected boolean myParseBoolean(String boolVal) throws Exception {
        boolVal = boolVal.toLowerCase();
        switch (boolVal) {
            case "true":
            case "yes":
            case "false":
            case "no":
                return Boolean.parseBoolean(boolVal);
            default:
                throw new Exception();
        }
    }

    // provides the framework for setting attributes
    // sets attributes of View (which hence are available in all Views)
    protected Map<String, Object> setAttributes(Collection<String> attributeSetter) throws Exception {
        Map<String, Object> modifiedAttributes = new HashMap<>();
        for (String attributeString : attributeSetter) {
            String[] attributeArray = attributeString.split(";");
            for (String attribute : attributeArray) {
                String[] assignment = attribute.split("=", 2);
                if (assignment.length != 2){
                    throw new Exception("Could not parse assignment: " + attribute);
                }
                String attName = assignment[0].toLowerCase();
                String attValue = assignment[1];
                switch (attName) {
                    // attributes available in all views
                    case "isactive":
                        isActive = Boolean.parseBoolean(attValue);
                        modifiedAttributes.put(attName, isActive);
                        break;
                    case "binmode":
                        binaryMode = BinaryMode.valueOf(attValue.toUpperCase());
                        modifiedAttributes.put(attName, binaryMode);
                        break;
                    case "semigrouping":
                        semiGrouping = Boolean.parseBoolean(attValue);
                        modifiedAttributes.put(attName, semiGrouping);
                        break;

                    case "resetrelstates":
                    case "resetrelevantstates":
                        resetRelevantStates();
                        break;
                    case "limit_data": // limit_data=view1=label11,label12 - view2=label22
//                            System.out.println("###############################3");
                        setStateRestriction(attValue);
                        attributes.put("staterestriction", stateRestriction);
                        setRelevantStates(stateRestriction);
                        attributes.put("relevantstates", relevantStates);
                        attributes.put("relevantStatesAreProperSubset", relevantStatesAreProperSubset);
                        break;
                    // views specific attributes
                    default:
                        modifiedAttributes.putAll(assignAttributes(attName, attValue)); // implemented in each (currently not yet) view
                }
                attributes.putAll(modifiedAttributes);
            }
        }
        return modifiedAttributes;
    }


    // crashes if column name (value in stateRestriction.keySet()) does not exist
    private void setRelevantStates(Map<String, Set<String>> stateRestriction) {
//        relevantStatesAreProperSubset = true;
//
//        // build query
//        StringBuilder query = new StringBuilder(String.format("SELECT %s FROM %s WHERE ", ENTRY_S_ID, model.getStateTableName()));
//        Iterator<String> viewIterator = stateRestriction.keySet().iterator();
////        messages.put("viewIterator.hasNext() ", List.of(String.valueOf(viewIterator.hasNext())));
//        while (viewIterator.hasNext()) {
//            query.append("(");
//            String view = viewIterator.next();
//            Iterator<String> labelIterator = stateRestriction.get(view).iterator();
//            while (labelIterator.hasNext()) {
//                String label = labelIterator.next();
//                query.append(String.format("%s = '%s'", view, label));
//                if (labelIterator.hasNext()) {
//                    query.append(" OR ");
//                }
//            }
//            if (viewIterator.hasNext()) {
//                query.append(") AND ");
//            }
//            else {
//                query.append(")");
//            }
//        }
//        // execute query and store result in relevantStates
//        relevantStates = new HashSet<>(model.getDatabase().executeCollectionQuery(query.toString(), Long.class));
    }

    private void resetRelevantStates(){
        relevantStatesAreProperSubset = false;
        //relevantStates = model.getMdpGraph().stateSet();
        attributes.put("relevantstates", "not displayed");
    }

    private void setStateRestriction(String restrictionString) {
        String[] viewRestrictionStrings = restrictionString.split("-");
        for (String viewRestrictionString : viewRestrictionStrings) {
            String[] viewRestrictionArr = viewRestrictionString.split("=",2);
            String viewName = viewRestrictionArr[0];
            String viewRestrictionValuesString = viewRestrictionArr[1];
            String[] viewRestrictionValuesArr = viewRestrictionValuesString.split("I");
            HashSet<String> viewRestrictionValuesSet = new HashSet<>(Arrays.asList(viewRestrictionValuesArr));
            stateRestriction.put(viewName, viewRestrictionValuesSet);
        }
    }

    // SHOULD BE OVERWRITTEN: assigns views specific in respective views
    // is intended to only be called from within setAttributes()
    protected Map<String, Object> assignAttributes(String attName, String attValue) throws Exception {
//        HashMap<String, Object> localOut = new HashMap<>();
//        localOut.put("Modified attributes", "None");
//        localOut.put("Reason", "This view has not yet implemented assertAttributes(). No attributes have been asserted.");
        return new HashMap<>();
    }

    // removes this views form model.views and from the DB
    public void remove() {
        removeFromDb(); // remove views from db and internally
        removeFromViewList();
    }

    public void removeFromDb() {
//        model.removeViewFromDbByColName(getCollumn());
    }

    public void removeFromViewList() {
//        model.removeFromViews(this);
    }

    public void rebuildView() throws Exception {
        removeFromDb();
        buildView();
    }

    public Map<String, Object> getAttributes() { return attributes; }

    protected boolean viewRequirementsFulfilled() {
        if (isBuilt()) {
            return false;
        }

//        if (model.getMdpGraph() == null) {
//            model.buildMdpGraph();
//        }

        return true;
    }

    protected Graph<Long, Long> createAlgoSubgraph(MdpGraph mdpGraph) {
        // created only if relevant states is a proper restriction of the state set
        Graph<Long, Long> algoSubgraph = mdpGraph;

        if (!relevantStates.equals(mdpGraph.stateSet())) {
            algoSubgraph = new AsSubgraph<>(mdpGraph, relevantStates);
        }

        return algoSubgraph;
    }

    protected String calcBinGroupingString(boolean hasProperty, String hasString, String hasNotString) {
        String groupingString;
        if (semiGrouping){
            switch (binaryMode) {
                case HIDE:
                    groupingString = hasProperty ? hasString : ENTRY_C_BLANK;
                    break;
                case SHOW: default:
                    groupingString = hasProperty ? ENTRY_C_BLANK : hasNotString;
                    break;
            }
        }
        else {
            groupingString = hasProperty ? hasString : hasNotString;
        }
        return groupingString;
    }

    public static <T> Class<T> unwrap(Class<T> c) {
        return (Class<T>) MethodType.methodType(c).unwrap().returnType();
    }
    public static <T> Class<T> wrap(Class<T> c) {
        return (Class<T>) MethodType.methodType(c).wrap().returnType();
    }

    public void setAndPutAtt(String s, Object o) throws Exception{
        Field field = View.class.getDeclaredField(s);
//            System.out.println("field type: " + wrap(field.getType()));
//            System.out.println("object class: " + o.getClass());
        if (wrap(field.getType()) == o.getClass()) {
            field.set(this, o);
//                field.setAccessible(true); // for final variables neccesary
//                System.out.println(misc);
//                System.out.println(field.getType());
            attributes.put(s.toLowerCase(), field.get(this));
        }
        else {
            throw new Exception("In assignment in constructor with setAndPutAtt(): type or class do not match");
        }
    }

    public static View createView(Project parent, ViewType type, List<String> parameters, int viewID) throws Exception {
        switch (type){
            case IdentityView: {
                return new IdentityView(parent, viewID, parameters);
            }
            case APView: {
                return new APView(parent, viewID, parameters);
            }
            case ReachabilityView: {
                return new ReachabilityView(parent, viewID, parameters);
            }
            case DistanceView: {
                return new DistanceView(parent, viewID, parameters);
            }
            case PropertyView: {
                if (parameters.size() != 2) throw new Exception("need 2 parameters (property name, and granularity of views)");
                String propertyName = parameters.get(0);
                double granularity2 = Double.parseDouble(parameters.get(1));
                return new PropertyView(parent, viewID, propertyName, granularity2, parameters);
            }
            case InitView: {
                return new InitView(parent, viewID, parameters);
            }
            case OutActView: {
                return new OutActView(parent, viewID, parameters);
            }
            case OutActIdentView: {
                return new OutActIdentView(parent, viewID, parameters);
            }
            case InActView: {
                return new InActView(parent, viewID, parameters);
            }
            case InActIdentView: {
                return new InActIdentView(parent, viewID, parameters);
            }
            case VariablesView: {
                return new VariablesView(parent, viewID, parameters);
            }
            case VariablesViewCnf: {
                return new VariablesViewCnf(parent, viewID, parameters);
            }
            case VariablesViewDnf: {
                return new VariablesViewDnf(parent, viewID, parameters);
            }
            case CycleView: {
                return new CycleView(parent, viewID, parameters);
            }
            case CycleHasView: {
                return new CycleHasView(parent, viewID, parameters);
            }
            case SccView: {
                return new SccView(parent, viewID, parameters);
            }
            case SccbView: {
                return new SccbView(parent, viewID, parameters);
            }
            case OutActSetSizeView: {
                return new OutActSetSizeView(parent, viewID, parameters);
            }
            case CollapseDualDirTransView: {
                return new CollapseDualDirTransView(parent, viewID, parameters);
            }
            default:
                throw new Exception("No fitting ViewType found");
        }
    }

}
