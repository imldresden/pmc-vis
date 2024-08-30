package prism.core;

import java.util.Arrays;
import java.util.HashSet;
import java.util.Set;


/**
 * interface used to define static Strings important for computation like table name templates, collumn names, etc.
 */
public interface Namespace {
    String ENTRY_S_ID = "state_id";
    String ENTRY_S_NAME = "state_name";
    String ENTRY_S_INIT = "initials";
    String ENTRY_REW = "reward_";
    String ENTRY_PROP = "property_";
    String ENTRY_SCHED = "scheduler_";
    String ENTRY_T_ID = "transition_id";
    String ENTRY_T_OUT = "state_out";
    String ENTRY_T_PROB = "probabilityDistribution";
    String ENTRY_T_ACT = "action";

    String ENTRY_R_ID = "id";
    String ENTRY_R_NAME = "name";
    String ENTRY_R_INFO = "info";

    String ENTRY_C_NAME = "View_Identifier";
    String ENTRY_C_SUB = "views";

    String ENTRY_SCH_NAME = "name";

    String ENTRY_SCH_ID = "id";

    String TABLE_STATES_GEN = "STATES_%s";
    String TABLE_TRANS_GEN = "TRANSITION_%s";

    String TABLE_SCHED_GEN = "SCHEDULER_INFO_%s";
    String TABLE_RES_GEN = "INFORMATION_%s";

    //Set<String> ENTRY_S_RESERVED = new HashSet<>(Arrays.asList(ENTRY_S_ID, ENTRY_S_NAME, ENTRY_C_SUB, ENTRY_S_INIT, ENTRY_S_REW));

    String PROJECT_MODEL = "model.prism";

    String PROFEAT_MODEL = "model.profeat";

    String SCHEDULER_FILE = "sched.csv";

    String DATABASE_FILE = "database.db";

    String TEMP_FILE = "temp.tra";

    String LOG_FILE = "time.log";

    String STYLE_FILE = "style.csv";

    Set<String> FILES_RESERVED = new HashSet<>(Arrays.asList(PROJECT_MODEL, PROFEAT_MODEL, SCHEDULER_FILE, TEMP_FILE, STYLE_FILE, LOG_FILE, DATABASE_FILE, DATABASE_FILE + "-shm", DATABASE_FILE + "-wal"));

    String OUTPUT_RESULTS = "Model Checking Results";

    String OUTPUT_VARIABLES = "Variable Values";

    String OUTPUT_REWARDS = "Reward Structures";

    String OUTPUT_LABELS = "Atomic Propositions";

    String OUTPUT_SCHEDULER = "Scheduler";

    String LABEL_INIT = "init";

    String LABEL_DEAD = "deadlock";

    String DEFAULT_STYLE =  "init:fa-solid fa-arrow-right\n" +
                            "deadlock:fa-solid fa-rotate-right";
    String ENTRY_C_BLANK = "__BLANK__";

    String C_CONCAT_SYMBOL = "|";
}
