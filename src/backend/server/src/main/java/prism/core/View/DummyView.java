package prism.core.View;

import prism.core.Project;

import java.util.ArrayList;
import java.util.List;

public class DummyView extends View {
    ViewType viewType;

    String viewName;

    boolean appendId = false;

    public DummyView(Project parent, long id, ViewType viewType) {
        super(parent, viewType, id, true);
        this.viewType = viewType;
        this.viewName = viewType.name();
    }
    public DummyView(Project parent, long id, ViewType viewType, String viewName){
        super(parent, viewType, id, true);
        this.viewType = viewType;
        this.viewName = viewName;
    }
    public DummyView(Project parent, long id, ViewType viewType, boolean appendId) {
        super(parent, viewType, id, true);
        this.viewType = viewType;
        this.appendId = appendId;
    }

    @Override
    public void buildView() {}

    @Override
    protected List<String> groupingFunction() { return new ArrayList<>(); }
    // is never called due to overwritten buildView()
    // can not be abstract since instances shall be created

    @Override
    public String getCollumn() {
        return !appendId ? viewName : viewName + "_" + dbColumnId;
    }

    @Override
    public void rebuildView() {
        attributes.put("ERROR", "This is a DummyView and currently can not be rebuilt");
        // TODO should build a default views of this Type using createView
        //  -> implementation of all constructors with attributesetters needed
//        model.createView(this.viewType, List.of());
    }

}
