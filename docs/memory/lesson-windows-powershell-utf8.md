---
name: lesson-windows-powershell-utf8
type: lesson
description: 2026-11-19: Windows PowerShell 5.1 Get-Content/Set-Content garble UTF-8 files; edit with the editor tools
updated: 2026-11-19
---

In [[session-12]] a `(Get-Content f -Raw) -replace ... | Set-Content -Encoding utf8` edit of an e2e spec turned `×` and `·` into `Ã—` and `Â·`, and the tests then looked for the garbled text. Windows PowerShell 5.1 reads a file without a BOM as the ANSI code page.

- Change source files with the Edit or Write tools, never with PowerShell text pipelines.
- To read UTF-8 in PowerShell, use `[IO.File]::ReadAllText(path)`. Console output of `Get-Content` can also look garbled (`Â·`) while the file is fine.
- `git commit -F -` with a here-string does not work in PowerShell 5.1; write the message to a file in the scratchpad and pass `-F <file>`.

See [[env-welcome-pc]], [[tooling]].
