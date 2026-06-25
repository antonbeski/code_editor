# Run01 ⬡

A premium, browser-based Python sandbox — edit and run Python instantly with zero server execution and zero setup. Built with Flask, Monaco Editor, and Pyodide (WebAssembly).

This repository features an ultra-premium, minimalist **Monochrome Glassmorphic** theme.

## Architecture & Stack

| Layer | Technology |
|-------|------------|
| **Server** | Flask (WSGI serving static templates) |
| **Editor** | Monaco Editor (fully customized monochrome theme with transparent integration) |
| **Runtime** | Pyodide — Python 3.x compiled to WebAssembly (running 100% client-side) |
| **Hosting** | Vercel (pre-configured serverless WSGI routing) |

## Features

- **Typographic Branding**: High-end minimalist branding with a custom badge and no heavy visual logos.
- **Glassmorphic Design**: Floating frosted-glass containers featuring deep-layered shadows and custom background blur effects.
- **Strict Monochrome Theme**: A design built entirely around black, white, and varying shades of gray (grayscale syntax highlighting and monochrome status markers).
- **Draggable Splitting**: Fluent resize handle separating the editor and console output.
- **Run History**: Live timing metrics and status reporting for each execution.
- **WASM execution**: Runs Python in-browser via Pyodide. Supports standard input/output.

## Project Structure

```text
code_editor/
├── api/
│   └── index.py            # Vercel serverless entrypoint
├── pyrunner/
│   ├── app.py              # Flask app initialization
│   ├── requirements.txt    # Flask dependency
│   ├── static/
│   │   ├── app.js          # Monaco theme & Pyodide execution script
│   │   └── style.css       # Glassmorphic Monochrome stylesheet
│   └── templates/
│       └── index.html      # Float layout page template
├── vercel.json             # Routing configs
└── requirements.txt        # Root requirements
```

## Running Locally

1. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```
2. Run the application:
   ```bash
   python pyrunner/app.py
   ```
3. Open [http://localhost:5000](http://localhost:5000) in your web browser.

## Deploying to Vercel

1. Push this repository to GitHub.
2. Link your repository in [Vercel](https://vercel.com).
3. The platform will automatically deploy your app using the configuration in `vercel.json` and `api/index.py`.
