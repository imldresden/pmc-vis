const vscode = require('vscode');

//Decorations in TextEditor
const decorations = require("./decorations.js");

const inactive = new vscode.ThemeIcon("issues");
const active = new vscode.ThemeIcon("issue-closed");

class StateProvider{
    constructor(activeEditor){
        this.activeEditor = activeEditor;
        if(activeEditor){
            this.deco = new decorations.Decorator(activeEditor.document.getText());
        }
        this._onDidChangeTreeData = new vscode.EventEmitter();
        this.onDidChangeTreeData = this._onDidChangeTreeData.event;

        this.rememberIDs = new Map();
        this.projectID = null;
        vscode.commands.executeCommand('setContext', 'stateView.connected', false);
        console.log("logged");
        this.refresh([]);
    }

    reconstruct(activeEditor){
        this.activeEditor = activeEditor;
        if(activeEditor){
            this.deco = new decorations.Decorator(activeEditor.document.getText());
        }
        this.projectID = null;
        vscode.commands.executeCommand('setContext', 'stateView.connected', false);

        //if (this.rememberIDs.has(activeEditor.document.fileName)){
        //    this.projectID = this.rememberIDs.get(activeEditor.document.fileName);
        //}
        console.log("relogged");
        this.refresh([]);
    }

    reload(){
        this.deco.updateInfo(this.getActiveState(), this.activeEditor);
        this._onDidChangeTreeData.fire(undefined);
    }

    register(id){
        this.projectID = id;
        vscode.commands.executeCommand('setContext', 'stateView.connected', true);
        vscode.window.showInformationMessage(`Linked to selections made in Project ${id}\n Please select a state to start`);
        //this.rememberIDs.set(this.activeEditor.document.fileName, id);
    }

    checkRegistration(id){
        return this.projectID === id;
    }

    refresh(data){
        if(!data){
            data = [];
        }
        this._states = [];
        this._activeState = null;
        this._count = 0;
        data.forEach(element => {
            const si = new StateItem(element.id, this._count++, null, element);
            this._states.push(si);
            this.parseStateData(element, si);
        });
        if(this._states.length > 0){
            this._activeState = this._states[0].activate();
        }
        this.reload()
    }

    parseStateData(data, si){
        const s1 = new StateItem("type", this._count++, si)
        s1.add_child(new StateItem(data.type, this._count++, s1));
        si.add_child(s1);

        const s2 = new StateItem("variables", this._count++, si)
        for(let key in data.variables){
            const sx = new StateItem(key, this._count++, s2);
            const value = `${data.variables[key]}`;
            sx.add_child(new StateItem(value, this._count++, sx));
            s2.add_child(sx);
        }
        si.add_child(s2);
    }

    getChildren(element){
        if(element){
            return element._children;
        }else{
            return this._states;
        }
    }

    getTreeItem(element){
        return element;
    }

    getParent(element){
        return element.getParent();
    }

    selectState(item)
    {
        if(item.getParent()){
            this.selectState(item.getParent());
        }else{
            if(this._activeState){
                this._activeState.deactivate();
            }
            this._activeState = item.activate();
            this.reload();
        }
    }

    unselectState(item)
    {
        if(!this._activeState){
            return;
        }
        if(item.getParent()){
            this.unselectState(item.getParent());
        }else{
            this._activeState.deactivate();
            this._activeState = null;
            this.reload();
        }
    }

    getActiveState(){
        if(!this._activeState){
            return null;
        }
        return this._activeState.getState();
    }
}

class StateItem extends vscode.TreeItem{
    constructor(label, number, parent, state = null){
        super(label, vscode.TreeItemCollapsibleState.None);
        this._label = label;
        this._number = number;
        this._children = [];
        this._parent = parent;
        this._state = state;

        if(parent){
            this.contextValue = "Child";
        }else{
            this.contextValue = "State";
            this.iconPath = inactive;
        }
    }

    add_child (child) {
        this.collapsibleState = vscode.TreeItemCollapsibleState.Collapsed;
        this._children.push(child);
    }

    getParent(){
        return this._parent;
    }

    getState(){
        return this._state;
    }

    activate(){
        this.iconPath = active;
        return this;
    }

    deactivate(){
        this.iconPath = inactive;
    }
}

module.exports = {StateItem, StateProvider}