
const vscode = require('vscode');

const constants = require("./constants.js");

class ProviderViewProvider {
    constructor(decorator) {
        this._openProvider = []
        this._decorator = decorator

        this._onDidChangeTreeData = new vscode.EventEmitter();
        this.onDidChangeTreeData = this._onDidChangeTreeData.event;
    }

    async fetchOptions(projectID, version) {
        this._openProvider = []
        await fetch(`http://${constants.ADDRESS}:8080/${projectID}/provider${version ? '?version=' + version : ''}`, {
            method: 'GET'
        }).then(
            result => result.json()
        ).then(
            // @ts-ignore
            data => {
                Object.entries(data).forEach(provider => {
                    const providerItem = new ProviderViewItem(provider[0], this._decorator);
                    Object.entries(provider[1]).forEach(property => {
                        const propertyItem = providerItem.add_child(property[0])
                        property[1].forEach(option => {
                            const optionItem = propertyItem.add_child(option.label, option.argument)
                            if (option.parameters) {
                                Object.entries(option.parameters).forEach(parameter => {
                                    const parameterItem = optionItem.add_child(parameter[0]);
                                    parameter[1].forEach(parameterValue => {
                                        parameterItem.add_child(parameterValue.label, parameterValue.value)
                                    })
                                })
                            }
                        })
                    })
                    this._openProvider.push(providerItem)
                })
            }).catch(
                error => {
                    vscode.window.showErrorMessage("Failed to Connect to PMC-Vis.\nIs the backend running?\n\n" + error)
                    return false;
                } // Handle the error response object
            );
        this._onDidChangeTreeData.fire(undefined);
    }

    refresh() {
        this.fetchOptions(this._decorator._projectID)
        this._onDidChangeTreeData.fire(undefined);
    }

    getChildren(element) {
        if (element) {
            return element._children;
        } else {
            return this._openProvider;
        }
    }

    getTreeItem(element) {
        return element;
    }

    openHighlighting(element) {
        element.openHighlighting()
    }

    selectParameter(element) {
        console.log(element)
        element._parent._children.forEach(child => {
            console.log(child)
            if (!(element.label === child.label)) {
                child.deactivate();
            }
        });
        this._onDidChangeTreeData.fire(undefined);
    }
}

class ProviderViewItem extends vscode.TreeItem {

    constructor(label, decorator, parent, cli) {
        console.log(label)
        super(label, vscode.TreeItemCollapsibleState.None);
        this._decorator = decorator;
        this._children = [];
        this._decorations = new Map();
        this._argument = cli;

        if (!parent) {
            this.contextValue = "Provider"
        } else {
            switch (parent.contextValue) {
                case "Provider":
                    this.contextValue = "Property"
                    break;
                case "Property":
                    this.contextValue = "Option"
                    break;
                case "Option":
                    this.contextValue = "Parameter"
                    break;
                case "Parameter":
                default:
                    this.contextValue = "ParameterValue"
                    this.checkboxState = vscode.TreeItemCheckboxState.Unchecked;
                    break;
            }
            this._parent = parent;
        }
    }

    add_child(label, cli) {
        if (this.collapsibleState == vscode.TreeItemCollapsibleState.None) {
            this.collapsibleState = vscode.TreeItemCollapsibleState.Collapsed;
        }
        const child = new ProviderViewItem(label, this._decorator, this, cli);
        this._children.push(child);
        return child
    }

    async openHighlighting() {
        let activeEditor = vscode.window.activeTextEditor
        if (activeEditor) {
            const document = activeEditor.document;

            let argument = this._argument;
            this._children.forEach(child => {
                const parameter = '$' + child.label;
                let value = undefined;
                child._children.forEach(grandChild => {
                    console.log(grandChild)
                    console.log(grandChild.checked())
                    if (grandChild.checked()) {
                        value = grandChild._argument;
                    }
                })
                console.log(value)
                if (!value) {
                    vscode.window.showWarningMessage("Not all parameters have been set");
                    return
                }

                argument = argument.replace(parameter, value);
            })

            argument = argument.split(" ").join("&arg=");

            const call = `http://${constants.ADDRESS}:8080/${this._decorator._projectID}/highlight:${this._parent._parent.label}:${this._parent.label}?arg=${argument}`
            console.log(call);
            fetch(call, {
                method: 'GET'
            }).then(
                result => result.json()
            ).then(
                // @ts-ignore
                data => data.forEach(d => {
                    if (!this._decorations.has(d.colorHex)) {
                        const decorationType = createDecorationType(d.colorHex)
                        this._decorations.set(d.colorHex, [decorationType, []])
                    }
                    const sPos = document.positionAt(d.startPosition);
                    const ePos = document.positionAt(d.endPosition);
                    const hover = new vscode.MarkdownString(d.hoverInfo);
                    hover.isTrusted = true;
                    hover.supportHtml = true;
                    const decoration = { range: new vscode.Range(sPos, ePos), hoverMessage: hover };
                    const exDeco = this._decorations.get(d.colorHex)
                    exDeco[1].push(decoration)

                    activeEditor.setDecorations(exDeco[0], exDeco[1])
                    console.log(d.colorHex)
                })
            ).catch(error => {
                console.log(error)
                vscode.window.showErrorMessage(error)
            })
        }
    }

    clear(activeEditor) {
        this._decorations.forEach((colorHex, decoration) => {
            activeEditor.setDecorations(decoration, [])
        })
    }

    deactivate() {
        if (this.contextValue === 'ParameterValue') {
            this.checkboxState = vscode.TreeItemCheckboxState.Unchecked;
        }
    }

    checked() {
        return (this.contextValue === 'ParameterValue') && (this.checkboxState == vscode.TreeItemCheckboxState.Checked);
    }
}

function createDecorationType(color) {
    return vscode.window.createTextEditorDecorationType({
        borderWidth: '1px',
        borderStyle: 'solid',
        overviewRulerColor: color,
        overviewRulerLane: vscode.OverviewRulerLane.Right,
        light: {
            // this color will be used in light color themes
            borderColor: color,
            backgroundColor: color
        },
        dark: {
            // this color will be used in dark color themes
            borderColor: color,
            backgroundColor: color
        }
    })
}

module.exports = { ProviderViewProvider }