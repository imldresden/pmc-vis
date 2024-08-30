package prism.core.Scheduler;

import java.util.regex.Pattern;

public interface Criteria {

    public static Pattern CriteriaPattern = Pattern.compile("^(SORT|FILTER)\\s+(.*?)( ASC| DESC)?\\s*$");
    public String getOrder();
}
