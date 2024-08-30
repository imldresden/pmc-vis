package prism.core.View;

import prism.core.Project;

import java.util.ArrayList;
import java.util.Collection;
import java.util.List;

public class IdentityView extends View {

    public IdentityView(Project model, long id, Collection<String> attributeSetter) throws Exception {
        super(model, ViewType.IdentityView, id, attributeSetter);
    }

    @Override
    public List<String> groupingFunction(){
        List<String> toExecute = new ArrayList<>();
        for (Long stateId : relevantStates) {
            toExecute.add(String.format("UPDATE %s SET %s = '%s' WHERE %s = '%s'",
                    model.getStateTableName(), getCollumn(), stateId, ENTRY_S_ID, stateId));
        }
        return toExecute;
    }

    @Override
    public String getCollumn() { return ViewType.IdentityView.name();}

}
