ResolveAI — AI Customer Support Agent

ResolveAI is a web-based customer support assistant for an e-commerce demo. Customers can chat about orders, shipping, cancellations, returns, refunds, and payments. The website connects to an AI agent in Microsoft Foundry through a FastAPI backend.

Features

Responsive chat interface with suggested support questions.

Conversation history saved in the browser, with options to start or clear chats.

Microsoft Foundry agent integration for customer support responses.

Six fictional orders (ORD101–ORD106) for testing order scenarios.

Automatic rejection of unknown order IDs such as ORD107.

Health check and interactive API documentation.

How it works

flowchart LR
    A[Customer] --> B[Chat website]
    B --> C[FastAPI backend]
    C --> D[Order ID check]
    D --> E[Microsoft Foundry agent]
    E --> C
    C --> B

When a customer sends a message, the backend checks any order ID against the local demo data. If the ID does not exist, it returns an order-not-found message. Other messages go to the configured Microsoft Foundry agent, which returns a response to the chat. Support policies and agent instructions are configured in Microsoft Foundry.

Tech stack

Layer

Technology

Frontend

HTML, CSS, JavaScript

Backend

Python, FastAPI

AI agent

Microsoft Foundry

HTTP client

HTTPX

Demo data

JSON

Getting started

Requirements

Python 3.10 or newer

A Microsoft Foundry project with a configured agent and API key

1. Open the app folder

After extracting the ZIP, open the inner resolveai-foundry folder in your terminal. It contains app.py, requirements.txt, and run.bat.

2. Configure Microsoft Foundry

Copy .env.example to a new file named .env in the same folder. Fill in your own values:

FOUNDRY_PROJECT_ENDPOINT=https://<resource>.services.ai.azure.com/api/projects/<project>
FOUNDRY_AGENT_NAME=<your-agent-name>
FOUNDRY_API_KEY=<your-api-key>
REQUEST_TIMEOUT_SECONDS=90

Add your support instructions and policy knowledge to the agent in Microsoft Foundry. Keep .env private and never commit your API key.

3. Run the website

Windows (PowerShell):

.\run.bat

macOS / Linux:

sh run.sh

The startup script creates a Python virtual environment, installs dependencies, and starts the server. Open http://localhost:8000 in your browser.

Try the demo

Ask ResolveAI

What it demonstrates

What is the return policy?

A support question handled by the Foundry agent.

Where is order ORD102?

A recognized demo order ID.

Where is order ORD107?

An unknown ID rejected by the backend.

The sample records are in static/orders (1).json. These are fictional orders for demonstration only.

API endpoints

Method

Route

Purpose

GET

/

Open the website.

GET

/api/health

Check whether the server is running and configured.

POST

/api/chat

Send a message and receive the assistant's reply.

GET

/docs

View interactive FastAPI documentation.

Example request to /api/chat:

{
  "message": "What is the return policy?",
  "conversation_id": null
}

The response contains answer and conversation_id. Send the returned conversation ID with the next message to continue the chat.

Project structure

resolveai-foundry/
├── app.py                 # FastAPI backend and Foundry connection
├── requirements.txt       # Python dependencies
├── run.bat                # Windows startup
├── run.sh                 # macOS/Linux startup
├── .env.example           # Configuration template
└── static/
    ├── index.html         # Chat website
    ├── app.js             # Chat and conversation history
    ├── styles.css         # Website styling
    └── orders (1).json    # Six fictional orders

Current scope

This version uses the JSON file to verify whether an order ID exists. It does not pass the matching order record to the Foundry agent or display an Orders page. Therefore, detailed answers about a valid order should not be treated as verified against the JSON file. The app has no MCP integration, customer login, or live order database.

Troubleshooting

The site says “Not Configured”: Check .env and restart the server.

Foundry returns 401/403: Check your API key and project access.

Foundry returns 404: Check your project endpoint and agent name.

The script cannot be found: Run it from the inner resolveai-foundry folder.

ResolveAI is a student project demonstrating how a customer support website can connect to a Microsoft Foundry AI agent.


