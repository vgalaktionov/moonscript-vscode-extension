// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below

"use strict";

const vscode = require("vscode")
const { exec } = require("child_process")

// Whether to lint or not
let doLint = false

let diagnosticCollection = vscode.languages.createDiagnosticCollection("moonscript")

// Extension starting point
function activate(context) {
  checkSettings()

  vscode.workspace.onDidChangeConfiguration(configEvent => {
    checkSettings()
  })

  vscode.workspace.onDidOpenTextDocument(doc => {
    if (doc.languageId === "moonscript") {
      lintFile(doc)
    }
  })

  vscode.workspace.onDidSaveTextDocument(doc => {
    if (doc.languageId === "moonscript") {
      lintFile(doc)
    }
  })

  context.subscriptions.push(diagnosticCollection)
}

function checkSettings() {
  doLint = vscode.workspace.getConfiguration().get("moonscript.enableLinting") === true
}

function lintFile(doc) {
  if (!doLint) {
    diagnosticCollection.clear()
    return;
  }

  exec(`moonpick ${doc.uri.fsPath}`, (err, stdout, stderr) => {
    if (stderr) {
      console.error(stderr)
      return
    }
    if (err) {
      const rawErrors = parseMoonpickOutput(stdout)
      diagnosticCollection.set(doc.uri, getDiagnostics(rawErrors, doc))
    } else {
      diagnosticCollection.clear()
    }
  })
}

function getDiagnostics(rawErrors, doc) {
  const diagnostics = []
  for (let i = 0; i < rawErrors.length; i += 2) {
    const lineNo = parseInt(rawErrors[i]) - 1
    const description = rawErrors[i + 1]
    const line = doc.lineAt(lineNo)
    let colStart = line.range.start.character
    let colEnd = line.range.end.character
    const problemStrMatch = description.match(/`(.*)`/)
    if (problemStrMatch) {
      const problemStr = problemStrMatch[1]
      colStart = line.text.indexOf(problemStr)
      colEnd = colStart + problemStr.length
    }
    const range = new vscode.Range(lineNo, colStart, lineNo, colEnd)
    diagnostics.push(new vscode.Diagnostic(range, description))
  }
  return diagnostics
}

function parseMoonpickOutput(stdout) {
  const errorRegex = /line\s+(\d+):\s(.*)\n/gm
  let rawErrors = []
  let match = errorRegex.exec(stdout)
  while (match) {
    rawErrors = rawErrors.concat(match.slice(1))
    match = errorRegex.exec(stdout)
  }
  return rawErrors
}

module.exports = {
  activate
}
