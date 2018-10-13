// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below

const vscode = require("vscode")
const { exec } = require("child_process")

let diagnosticCollection
// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
function activate(context) {
  vscode.workspace.onDidChangeTextDocument(changeEvent => {
    const doc = changeEvent.document
    if (doc.languageId === "moonscript") {
      lintFile(doc)
    }
  })

  vscode.workspace.onDidOpenTextDocument(doc => {
    if (doc.languageId === "moonscript") {
      lintFile(doc)
    }
  })

  diagnosticCollection = vscode.languages.createDiagnosticCollection(
    "moonscript"
  )
  context.subscriptions.push(diagnosticCollection)
}

function lintFile(doc) {
  exec(`moonpick ${doc.uri.fsPath}`, (err, stdout, stderr) => {
    if (stderr) {
      console.error(stderr)
      return
    }
    if (err) {
      const rawErrors = parseMoonpickOutput(stdout)
      diagnosticCollection.set(doc.uri, getDiagnostics(rawErrors, doc))
    } else {
      diagnosticCollection.set(doc.uri, [])
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
