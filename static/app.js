const STORAGE_KEY = "resolveai_conversations_v1";
const state = { conversations: [], activeId: null, sending: false };

const el = {
  historyList: document.querySelector("#historyList"), messages: document.querySelector("#messages"),
  welcome: document.querySelector("#welcomeState"), form: document.querySelector("#chatForm"),
  input: document.querySelector("#messageInput"), send: document.querySelector("#sendButton"),
  error: document.querySelector("#errorBanner"), sidebar: document.querySelector("#sidebar"),
  overlay: document.querySelector("#sidebarOverlay")
};

function uid() { return crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`; }
function activeConversation() { return state.conversations.find(c => c.id === state.activeId); }
function save() { localStorage.setItem(STORAGE_KEY, JSON.stringify(state.conversations)); }

function load() {
  try { state.conversations = JSON.parse(localStorage.getItem(STORAGE_KEY)) || []; }
  catch { state.conversations = []; }
  state.activeId = state.conversations[0]?.id || null;
  render();
}

function createConversation() {
  const conversation = { id: uid(), foundryId: null, title: "New conversation", updatedAt: Date.now(), messages: [] };
  state.conversations.unshift(conversation); state.activeId = conversation.id; save(); render();
  el.input.focus(); closeSidebar();
  return conversation;
}

function render() { renderHistory(); renderMessages(); }

function renderHistory() {
  el.historyList.replaceChildren();
  if (!state.conversations.length) {
    const empty = document.createElement("div"); empty.className = "history-empty";
    empty.textContent = "Your conversations will appear here."; el.historyList.append(empty); return;
  }
  [...state.conversations].sort((a,b) => b.updatedAt-a.updatedAt).forEach(conversation => {
    const item = document.createElement("div"); item.className = `history-item${conversation.id === state.activeId ? " active" : ""}`;
    const open = document.createElement("button"); open.className = "history-open"; open.textContent = conversation.title; open.title = conversation.title;
    open.addEventListener("click", () => { state.activeId = conversation.id; render(); closeSidebar(); });
    const remove = document.createElement("button"); remove.className = "history-delete"; remove.textContent = "×"; remove.setAttribute("aria-label", `Delete ${conversation.title}`);
    remove.addEventListener("click", e => { e.stopPropagation(); deleteConversation(conversation.id); });
    item.append(open, remove); el.historyList.append(item);
  });
}

function renderMessages() {
  el.messages.replaceChildren(); const conversation = activeConversation();
  if (!conversation || conversation.messages.length === 0) {
    el.messages.append(el.welcome); el.welcome.hidden = false;
    bindSuggestions(); return;
  }
  conversation.messages.forEach(message => appendMessage(message.role, message.content, false));
  el.messages.scrollTop = el.messages.scrollHeight;
}

function appendMessage(role, content, animate = true) {
  if (el.welcome.isConnected) el.welcome.remove();
  const row = document.createElement("div"); row.className = `message-row ${role}`;
  if (!animate) row.style.animation = "none";
  if (role === "assistant") { const avatar = document.createElement("span"); avatar.className = "message-avatar"; avatar.textContent = "AI"; row.append(avatar); }
  const bubble = document.createElement("div"); bubble.className = "bubble"; bubble.textContent = content; row.append(bubble); el.messages.append(row);
  el.messages.scrollTop = el.messages.scrollHeight;
}

function showTyping() {
  const row = document.createElement("div"); row.id = "typingRow"; row.className = "message-row assistant";
  row.innerHTML = '<span class="message-avatar">AI</span><div class="bubble typing"><span></span><span></span><span></span></div>';
  el.messages.append(row); el.messages.scrollTop = el.messages.scrollHeight;
}

function getApiBaseUrl() {
  if (window.RESOLVEAI_API_URL) return window.RESOLVEAI_API_URL.replace(/\/+$/, "");
  const stored = localStorage.getItem("resolveai_backend_url");
  if (stored) return stored.replace(/\/+$/, "");
  if (window.location && window.location.protocol && window.location.protocol.startsWith("http")) {
    return window.location.origin;
  }
  return "http://localhost:8000";
}

function updateServerDisplay() {
  const display = document.querySelector("#serverAddressDisplay");
  if (display) {
    const url = getApiBaseUrl();
    try {
      const parsed = new URL(url);
      display.textContent = `Backend: ${parsed.host}`;
    } catch {
      display.textContent = `Backend: ${url}`;
    }
  }
}

async function checkBackendHealth() {
  const badge = document.querySelector("#agentStatusBadge");
  const dot = document.querySelector("#serverStatusDot");
  updateServerDisplay();
  try {
    const res = await fetch(`${getApiBaseUrl()}/api/health`);
    if (res.ok) {
      const data = await res.json();
      if (data.configured) {
        if (badge) badge.innerHTML = `<i></i> Online`;
        if (dot) dot.style.background = "#35d1a5";
        clearError();
      } else {
        if (badge) badge.innerHTML = `<i style="background:#f59e0b"></i> Not Configured`;
        if (dot) dot.style.background = "#f59e0b";
        showError("Backend is running, but Microsoft Foundry credentials are missing or incomplete in .env on Laptop A.");
      }
    } else {
      if (badge) badge.innerHTML = `<i style="background:#ef4444"></i> Server Error (${res.status})`;
      if (dot) dot.style.background = "#ef4444";
    }
  } catch {
    if (badge) badge.innerHTML = `<i style="background:#ef4444"></i> Offline`;
    if (dot) dot.style.background = "#ef4444";
  }
}

function setupBackendConfigPrompt() {
  const trigger = document.querySelector("#serverSettingsTrigger");
  if (!trigger) return;
  trigger.addEventListener("click", () => {
    const current = getApiBaseUrl();
    const input = prompt(
      "Enter Laptop A Backend URL (e.g. http://192.168.1.50:8000 or leave blank to auto-detect):",
      localStorage.getItem("resolveai_backend_url") || current
    );
    if (input !== null) {
      const trimmed = input.trim();
      if (!trimmed) {
        localStorage.removeItem("resolveai_backend_url");
      } else {
        localStorage.setItem("resolveai_backend_url", trimmed.replace(/\/+$/, ""));
      }
      updateServerDisplay();
      checkBackendHealth();
    }
  });
}

async function sendMessage(text) {
  if (state.sending || !text.trim()) return;
  let conversation = activeConversation() || createConversation(); const cleanText = text.trim();
  if (conversation.messages.length === 0) conversation.title = cleanText.length > 42 ? `${cleanText.slice(0, 42)}…` : cleanText;
  conversation.messages.push({ role: "user", content: cleanText }); conversation.updatedAt = Date.now(); save();
  el.input.value = ""; resizeInput(); setSending(true); clearError(); renderHistory(); appendMessage("user", cleanText); showTyping();
  try {
    const apiUrl = `${getApiBaseUrl()}/api/chat`;
    const response = await fetch(apiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: cleanText, conversation_id: conversation.foundryId })
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(data.detail || `Server returned error (${response.status})`);
    }
    document.querySelector("#typingRow")?.remove();
    conversation.foundryId = data.conversation_id;
    conversation.messages.push({ role: "assistant", content: data.answer });
    conversation.updatedAt = Date.now();
    save();
    appendMessage("assistant", data.answer);
    renderHistory();
  } catch (error) {
    document.querySelector("#typingRow")?.remove();
    const isNetworkError = error.name === "TypeError" || error.message.includes("Failed to fetch") || error.message.includes("NetworkError");
    if (isNetworkError) {
      showError(`Cannot connect to backend server at ${getApiBaseUrl()}. Make sure Laptop A is running: python -m uvicorn app:app --host 0.0.0.0 --port 8000 and both laptops are on the same Wi-Fi.`);
    } else {
      showError(error.message);
    }
  }
  finally { setSending(false); el.input.focus(); }
}

function setSending(value) { state.sending = value; el.send.disabled = value; el.input.disabled = value; }
function showError(message) { el.error.textContent = message; el.error.classList.add("visible"); }
function clearError() { el.error.classList.remove("visible"); el.error.textContent = ""; }
function deleteConversation(id) { state.conversations = state.conversations.filter(c => c.id !== id); if (state.activeId === id) state.activeId = state.conversations[0]?.id || null; save(); render(); }
function clearHistory() { if (!state.conversations.length || confirm("Clear all conversation history from this browser?")) { state.conversations = []; state.activeId = null; save(); render(); } }
function bindSuggestions() { document.querySelectorAll("[data-message]").forEach(button => button.addEventListener("click", () => sendMessage(button.dataset.message), { once: true })); }
function resizeInput() { el.input.style.height = "auto"; el.input.style.height = `${Math.min(el.input.scrollHeight, 120)}px`; }
function openSidebar() { el.sidebar.classList.add("open"); el.overlay.classList.add("visible"); }
function closeSidebar() { el.sidebar.classList.remove("open"); el.overlay.classList.remove("visible"); }

el.form.addEventListener("submit", event => { event.preventDefault(); sendMessage(el.input.value); });
el.input.addEventListener("input", resizeInput);
el.input.addEventListener("keydown", event => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); el.form.requestSubmit(); } });
document.querySelector("#newChatButton").addEventListener("click", createConversation);
document.querySelector("#resetChatButton").addEventListener("click", createConversation);
document.querySelector("#clearHistoryButton").addEventListener("click", clearHistory);
document.querySelector("#openSidebar").addEventListener("click", openSidebar);
document.querySelector("#closeSidebar").addEventListener("click", closeSidebar);
el.overlay.addEventListener("click", closeSidebar);

setupBackendConfigPrompt();
load();
checkBackendHealth();


