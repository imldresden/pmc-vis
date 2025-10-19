package prism.core.mdpgraph;

public class MdpTransition {

    private Long id;

//    private Long origTransId;
    private Long source;

    private Long target;

    private String action;

//    private Map<String, Double> results;

//    private Map<String, Double> scheduler;

    MdpTransition(
            Long id,
            Long origTransId,
            Long source,
            Long target,
            String action
//            Map<String,Double> results,
//            Map<String, Double> scheduler
    ) {
        this.id = id;
//        this.origTransId = origTransId;
        this.source = source;
        this.target = target;
        this.action = action;
//        this.results = results;
//        this.scheduler = scheduler;
    }
    public Long getId() {return id;}

//    public Long getOrigTransId() { return origTransId; }

    public String getAction() { return action; }

    public Long getSource() { return source; }

    public Long getTarget() { return target; }



}
