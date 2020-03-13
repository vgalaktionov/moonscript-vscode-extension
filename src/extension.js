// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below

'use strict';

const { workspace, languages, Diagnostic, Position, Range } = require('vscode')
const execa = require('execa')

// Whether to lint or not
let lintEnabled = false
// Path to the moonpick executable
let moonpickPath = 'moonpick'

let diagnosticCollection = languages.createDiagnosticCollection('moonscript')

// Extension starting point
function activate(context) {
  checkSettings()

  workspace.onDidChangeConfiguration(checkSettings)
  workspace.onDidOpenTextDocument(lintFile)
  workspace.onDidSaveTextDocument(lintFile)

  context.subscriptions.push(diagnosticCollection)
}

function checkSettings() {
  const config = workspace.getConfiguration()
  lintEnabled = config.get('moonscript.enableLinting') === true
  const customPath = config.get('moonscript.moonpickPath')
  if (customPath) {
    moonpickPath = customPath
  }
}

function clearErrors() {
  diagnosticCollection.clear()
}

function lintFile(doc) {
  if (!lintEnabled || doc.languageId !== 'moonscript') {
    clearErrors()
    return;
  }

  execa(moonpickPath, [doc.uri.fsPath])
    .then(clearErrors)
    .catch(({ stdout, stderr }) => {
      if (stderr) {
        console.error(stderr)
      } else {
        const diagnosticErrors = moonpickOutputToDiagnostics(stdout, doc)
        diagnosticCollection.set(doc.uri, diagnosticErrors)
      }
    })
}

function moonpickErrorToDiagnostic(moonpickError, doc) {
  const {
    errorLineNumber,
    errorSnippet,
    errorDescription
  } = moonpickError
  const lineIndex = parseInt(errorLineNumber) - 1
  if (lineIndex < 0) {
    return null
  }
  const linePosition = new Position(lineIndex, 0)
  if (!doc.validatePosition(linePosition)) {
    return null
  }
  const line = doc.lineAt(linePosition)
  const errorStartCharIndex = line.text.indexOf(errorSnippet)
  if (errorStartCharIndex < 0) {
    return null
  }
  const errorStartPosition = linePosition.translate({ characterDelta: errorStartCharIndex })
  const errorStopPosition = errorStartPosition.translate({ characterDelta: errorSnippet.length })
  const errorRange = new Range(errorStartPosition, errorStopPosition)
  if (!line.range.contains(errorRange)) {
    return null
  }
  return new Diagnostic(errorRange, errorDescription)
}

function moonpickOutputToDiagnostics(stdout, doc) {
  const errorRegex = /^\s*line\s+(?<errorLineNumber>\d+)\s*:\s*(?<errorDescription>.+)\n\s*=+\s*\n\s*>\s*(?<errorSnippet>.+)\n/gm
  let match = null
  const diagnosticArray = []
  while (match = errorRegex.exec(stdout)) {
    const diagnostic = moonpickErrorToDiagnostic(match.groups, doc)
    if (diagnostic) {
      diagnosticArray.push(diagnostic)
    } else {
      console.warn('Unable to parse moonpick line into diagnostic', match)
    }
  }
  return diagnosticArray
}

module.exports = {
  activate
}
