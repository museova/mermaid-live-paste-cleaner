# mermaid-live-paste-cleaner

Tampermonkey script that strips Markdown Mermaid fences when pasting into Mermaid Live Editor.

## Install

Open this userscript URL after the repository is pushed:

https://raw.githubusercontent.com/museova/mermaid-live-paste-cleaner/main/mermaid-live-paste-cleaner.user.js

Tampermonkey should detect it and show the install screen.

## What It Does

When you paste a complete Markdown Mermaid code block into https://mermaid.live/edit:

````markdown
```mermaid
graph TD
  A --> B
```
````

it inserts only the Mermaid source:

```mermaid
graph TD
  A --> B
```

If the pasted text does not have a ` ```mermaid` opening fence and a closing ` ``` ` fence, the script leaves it unchanged.

## Scope

- Runs only on `https://mermaid.live/*`
- Handles `mermaid` case-insensitively
- Supports Unix and Windows newlines
- Does not rewrite the system clipboard
