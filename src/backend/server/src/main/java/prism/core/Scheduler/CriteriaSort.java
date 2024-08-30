package prism.core.Scheduler;

public class CriteriaSort implements Criteria{
    public enum Direction{ASC, DESC};

    private final Direction direction;
    private final String collumn;

    public CriteriaSort(String collumn, Direction direction){
        this.direction = direction;
        this.collumn = collumn;
    }

    public String getOrder(){
        return String.format("%s %s", collumn, direction);
    }
}
