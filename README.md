# Voice2Text Pro

Voice2Text Pro is a sleek, black-and-yellow themed web application that allows users to record their voice from the browser and transcribe it using AI via an N8N workflow.

## Features

- **Voice Recording:** Record high-quality audio directly in the browser.
- **N8N Integration:** Seamlessly connects to N8N webhooks for processing.
- **Support for Multiple Formats:** Handles both JSON and plain-text transcription responses.
- **Modern UI:** Premium design with interactive elements and smooth animations.
- **Copy to Clipboard:** One-tap copying of transcribed text.

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) installed on your machine.
- An N8N instance (local or cloud).
- [Optional] An AssemblyAI or OpenAI API key for transcription.

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/ira225ibra230-sudo/Voice2Text-Pro-Final-v2.git
   cd Voice2Text-Pro-Final-v2
   ```

2. Run the local server:
   ```bash
   node server.js
   ```

3. Open your browser and navigate to:
   ```
   http://localhost:3000
   ```

### Configuration

1. In the application footer, enter your N8N Webhook URL.
2. Ensure your N8N workflow is configured to return transcription text.

## N8N Workflow

An example workflow for AssemblyAI is included in the `n8n_assemblyai_workflow.json` file. You can import this directly into your N8N instance.

## Author

ira225ibra230-sudo
