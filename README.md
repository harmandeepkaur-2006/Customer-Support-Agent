# ResolveAI — Microsoft Foundry Customer Support Website

ResolveAI is a responsive customer support chat application connected to your Microsoft Foundry agent.
The architecture separates concerns:
- **Backend (Laptop A)** holds all Microsoft Foundry credentials in `.env`, communicates with Microsoft Foundry over REST, and serves the API and web UI.
- **Frontend (Laptop B / Browser)** accesses the application over the local network (Wi-Fi) without needing any Azure credentials, `az login`, Azure CLI, or API keys.

---

## Architecture Overview

```
Laptop B (Browser / Client)
       │
       │ HTTP /api/chat
       ▼
Laptop A (FastAPI Backend, listening on 0.0.0.0:8000)
       │
       │ REST API with api-key header
       ▼
Microsoft Foundry Agent (Customer-Support-Agent)
```

---

## Laptop A Setup (Backend + Microsoft Foundry)

Laptop A is where the teammate runs the backend. It holds the `.env` file with Foundry credentials.

### 1. Configure `.env`
Ensure `.env` in `resolveai-foundry/` has:
```env
FOUNDRY_API_KEY=your-foundry-api-key
FOUNDRY_PROJECT_ENDPOINT=https://<resource>.services.ai.azure.com/api/projects/<project>
FOUNDRY_AGENT_NAME=Customer-Support-Agent
REQUEST_TIMEOUT_SECONDS=90
```

### 2. Run the Server
Open Command Prompt in `resolveai-foundry/` and run:

**Option A (Using run.bat):**
```bat
run.bat
```
*(This automatically installs dependencies and starts the server on localhost:8000)*

**Option B (Manual command):**
```bat
py -m venv .venv
.venv\Scripts\activate
python -m pip install -r requirements.txt
python -m uvicorn app:app --host localhost --port 8000
```

### 3. Find Laptop A's Local IP Address
In Command Prompt on Laptop A, run:
```bat
ipconfig
```
Look for **IPv4 Address** under your active Wi-Fi adapter (for example: `192.168.1.45`).

---

## Laptop B Setup (Frontend / Browser)

Laptop B does **NOT** need Python, Azure CLI, `az login`, or any API keys!

1. Make sure Laptop B is connected to the **same Wi-Fi network** as Laptop A.
2. Open any web browser on Laptop B (Chrome, Edge, Safari, Firefox).
3. Navigate to:
   ```
   http://<LAPTOP_A_IP>:8000
   ```
   *(Example: `http://192.168.1.45:8000`)*
4. The ResolveAI customer support interface will load immediately, and the status indicator will show **Online**.
5. Start chatting! Messages will flow through Laptop A to Microsoft Foundry and back.

---

## Troubleshooting & Network Tips

- **Cannot connect from Laptop B?**
  - Verify both laptops are connected to the same Wi-Fi.
  - On Laptop A, make sure Windows Firewall allows Python/Uvicorn on port 8000 (if prompted by Windows Security Alert, click **Allow access** on Private networks).
  - Test health check from Laptop B browser: `http://<LAPTOP_A_IP>:8000/api/health`. It should return `{"status":"ok","configured":true,...}`.

- **Custom Backend URL (if running frontend separately):**
  - If you open `static/index.html` standalone on Laptop B, click the **Support agent** status in the bottom-left sidebar to enter Laptop A's IP address.

---

## Endpoints

- Web App: `GET /`
- Health check: `GET /api/health`
- Chat API: `POST /api/chat`

Example chat request:
```json
{
  "message": "Where is my order ORD101?",
  "conversation_id": null
}
```

---

## Security Note

**Never commit `.env` to GitHub.** `.env` is included in `.gitignore` to protect your Microsoft Foundry API keys.


