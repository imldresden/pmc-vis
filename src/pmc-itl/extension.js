// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
const vscode = require('vscode');

//Semantic tokenizer
const token = require ("./src/tokens.js");

//Basic internal server setup
const express = require('express');
const cors = require('cors');
const { StateProvider } = require('./src/stateView.js');
const app = express();
app.use(cors());
app.use(express.json({limit: '50mb'}));
const port = 3001;

let activeStateProvider;

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
/**
 * @param {vscode.ExtensionContext} context
 */
function activate(context) {
    context.subscriptions.push(vscode.languages.registerDocumentSemanticTokensProvider({ language: 'mdp' }, new token.DocumentSemanticTokensProvider(), token.tokenLegend));

    //Start an internal server to listen to pmc-vis
    app.use(express.json());
    app.post(`/:id/update`, (req, res) => {
        const id = req.params.id;
        if(activeStateProvider.checkRegistration(id)){
            const states = filterState(req.body);
            activeStateProvider.refresh(states);
        }
        res.send("ok");
    })
    app.listen(port, () => {
        const message = `Listening to PMC-Vis on port ${port}`;
        vscode.window.showInformationMessage(message);
        console.log(message);
    })

    let activeEditor = vscode.window.activeTextEditor;
    activeStateProvider = new StateProvider(activeEditor);

    //register All commands using global variables initialised in openDocument()
    context.subscriptions.push(vscode.window.registerTreeDataProvider("stateView", activeStateProvider));
    context.subscriptions.push(vscode.commands.registerCommand('pmcVis.connect', connectToPMCVis));
    context.subscriptions.push(vscode.commands.registerCommand('pmcVis.moveTo', item => moveTo(item)));
    context.subscriptions.push(vscode.commands.registerCommand('stateView.select', item => activeStateProvider.selectState(item)));
    context.subscriptions.push(vscode.commands.registerCommand('stateView.unselect', item => activeStateProvider.unselectState(item)));
    context.subscriptions.push(vscode.window.onDidChangeActiveTextEditor(openDocument));
}

function openDocument(){
    let activeEditor = vscode.window.activeTextEditor;
    if(activeEditor){
        activeStateProvider.reconstruct(activeEditor);
    }
}

async function connectToPMCVis(){
    const id = await vscode.window.showInputBox();
    if(!id){
        return;
    }
    activeStateProvider.register(id);
}

//Here we decsribe the structure of the global state object
function filterState(data) {
    data = data.map(d => {
        const vars = d.details["Variable Values"]
        Object.keys(vars).forEach(k => vars[k] = vars[k].value);

        return {
            id: d.id,
            type: d.type,
            variables: vars
        };
    });
    
    return data;
}

function moveTo(line){
    let activeEditor = vscode.window.activeTextEditor;
    if(activeEditor){
        activeEditor.revealRange(new vscode.Range(line, 0, line+10, 0), vscode.TextEditorRevealType.InCenter);
    }
}

// This method is called when your extension is deactivated
function deactivate() {}

module.exports = {
	activate,
	deactivate
}
