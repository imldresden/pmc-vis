package prism.core.mdpgraph;

import prism.api.State;

import java.util.Map;

/**
 * Class to represent transitions for the internal graph (mdpGraph)
 */

public class MdpTransitionOld {

    // all attributes are supposed to be directly taken from the corresponding transition
    // an MdpTransitionOld has no probability distribution but only one single probability
    // this single probability is stored as edge weight (not in this class but in MdpGraphOld)

    private long id;
    private State source;

    private State target;

    private String action;

    private Map<String, Double> results;

    private Map<String, Double> scheduler;

    MdpTransitionOld(
            long id,
            State source,
            State target,
            String action,
            Map<String,Double> results,
            Map<String, Double> scheduler
    ) {
        this.id = id;
        this.source = source;
        this.target = target;
        this.action = action;
        this.results = results;
        this.scheduler = scheduler;
    }

    @Override
    public String toString(){
        return "(" + source.getId() + ", " + target.getId() + ")";
    }
}
