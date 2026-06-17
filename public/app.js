const messagesEl = document.getElementById('messages');
const welcomeWrapper = document.getElementById('welcomeWrapper');
const chatContainer = document.getElementById('chatContainer');
const chatHeader = document.getElementById('chatHeader');
const inputArea = document.getElementById('inputArea');
const chatTitleText = document.getElementById('chatTitleText');

// Welcome input
const messageInput = document.getElementById('messageInput');
const sendBtn = document.getElementById('sendBtn');

// Conversation input
const messageInputBottom = document.getElementById('messageInputBottom');
const sendBtnBottom = document.getElementById('sendBtnBottom');

const newChatBtn = document.getElementById('newChatBtn');
const helpLauncherBtn = document.getElementById('helpLauncherBtn');
const profileMenuWrap = document.getElementById('profileMenuWrap');
const profileMenuTrigger = document.getElementById('profileMenuTrigger');
const profileMenu = document.getElementById('profileMenu');
const profileGetHelpBtn = document.getElementById('profileGetHelpBtn');
const helpDrawer = document.getElementById('helpDrawer');
const helpCloseBtn = document.getElementById('helpCloseBtn');
const helpMenuBtn = document.getElementById('helpMenuBtn');
const helpMenu = document.getElementById('helpMenu');
const helpEndBtn = document.getElementById('helpEndBtn');
const helpMessages = document.getElementById('helpMessages');
const helpInput = document.getElementById('helpInput');
const helpSendBtn = document.getElementById('helpSendBtn');
const helpStatusText = document.getElementById('helpStatusText');
const helpHomeView = document.getElementById('helpHomeView');
const helpThreadView = document.getElementById('helpThreadView');
const helpSendMessageCta = document.getElementById('helpSendMessageCta');

let conversationHistory = [];
let isWaiting = false;
let inConversation = false;
let isHelpLoading = false;
let helpSession = null;
let isHelpOpen = false;
let helpPollingId = null;
let awaitingAgentReply = false;
let isProfileMenuOpen = false;
const helpRenderedIds = new Set();
const pendingUserMessages = [];

// Get active input
function getActiveInput() {
  return inConversation ? messageInputBottom : messageInput;
}

function getActiveSendBtn() {
  return inConversation ? sendBtnBottom : sendBtn;
}

// Auto-resize for both textareas
[messageInput, messageInputBottom].forEach(input => {
  input.addEventListener('input', () => {
    input.style.height = 'auto';
    input.style.height = Math.min(input.scrollHeight, 200) + 'px';
    const btn = input === messageInput ? sendBtn : sendBtnBottom;
    btn.disabled = !input.value.trim();
  });

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (input.value.trim() && !isWaiting) {
        sendMessage(input.value.trim());
        input.value = '';
        input.style.height = 'auto';
      }
    }
  });
});

// Send buttons
sendBtn.addEventListener('click', () => {
  if (messageInput.value.trim() && !isWaiting) {
    sendMessage(messageInput.value.trim());
    messageInput.value = '';
    messageInput.style.height = 'auto';
    sendBtn.disabled = true;
  }
});

sendBtnBottom.addEventListener('click', () => {
  if (messageInputBottom.value.trim() && !isWaiting) {
    sendMessage(messageInputBottom.value.trim());
    messageInputBottom.value = '';
    messageInputBottom.style.height = 'auto';
    sendBtnBottom.disabled = true;
  }
});

// Suggestion chips
document.querySelectorAll('.suggestion-chip').forEach(chip => {
  chip.addEventListener('click', () => {
    sendMessage(chip.dataset.message);
  });
});

// New chat
newChatBtn.addEventListener('click', () => {
  conversationHistory = [];
  inConversation = false;
  messagesEl.textContent = '';
  welcomeWrapper.classList.remove('hidden');
  chatContainer.classList.remove('visible');
  chatHeader.classList.remove('visible');
  inputArea.classList.remove('visible');
  messageInput.value = '';
  messageInput.placeholder = 'How can I help you today?';
  sendBtn.disabled = true;
  messageInput.focus();
});

function switchToConversation(firstMsg) {
  inConversation = true;
  welcomeWrapper.classList.add('hidden');
  chatContainer.classList.add('visible');
  chatHeader.classList.add('visible');
  inputArea.classList.add('visible');
  chatTitleText.textContent = firstMsg.length > 35 ? firstMsg.substring(0, 32) + '...' : firstMsg;
  messageInputBottom.focus();
}

async function sendMessage(message) {
  if (!message || isWaiting) return;

  // Switch to conversation mode on first message
  if (!inConversation) {
    switchToConversation(message);
  }

  // Add user message to UI
  appendUserMessage(message);
  conversationHistory.push({ role: 'user', content: message });

  // Disable send
  sendBtn.disabled = true;
  sendBtnBottom.disabled = true;
  isWaiting = true;

  // Show thinking indicator
  const thinkingEl = showThinking();

  try {
    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message,
        conversationHistory
      })
    });

    const data = await response.json();
    thinkingEl.remove();

    if (data.error) {
      appendAssistantMessage('I apologize, but I encountered an error. Please try again.');
    } else {
      appendAssistantMessage(data.response, data.actions);
      conversationHistory.push({
        role: 'assistant',
        content: data.response,
        state: data.conversationState
      });
    }
  } catch (err) {
    thinkingEl.remove();
    appendAssistantMessage('I apologize, but I\'m having trouble connecting. Please try again.');
  }

  isWaiting = false;
  scrollToBottom();
}

function appendUserMessage(content) {
  const messageEl = document.createElement('div');
  messageEl.className = 'message user-message';

  const bubble = document.createElement('div');
  bubble.className = 'message-bubble';
  bubble.textContent = content;

  messageEl.appendChild(bubble);
  messagesEl.appendChild(messageEl);
  scrollToBottom();
}

function appendAssistantMessage(content, actions) {
  const messageEl = document.createElement('div');
  messageEl.className = 'message assistant-message';

  const contentEl = document.createElement('div');
  contentEl.className = 'message-content';
  renderFormattedContent(contentEl, content);

  // Action badges
  if (actions && actions.length > 0) {
    actions.forEach(a => {
      const badge = document.createElement('div');
      badge.className = 'action-badge';
      if (a.type === 'case_created') {
        badge.textContent = '\u26A1 Salesforce Case Created' + (a.caseId !== 'demo-mode' ? '' : ' (demo mode)');
      } else if (a.type === 'task_created') {
        badge.textContent = '\u26A1 Salesforce Task Created' + (a.taskId !== 'demo-mode' ? '' : ' (demo mode)');
      }
      contentEl.appendChild(badge);
    });
  }

  messageEl.appendChild(contentEl);

  // Reaction icons
  const reactions = document.createElement('div');
  reactions.className = 'message-reactions';
  ['\u2398', '\uD83D\uDC4D', '\uD83D\uDC4E', '\u21BB'].forEach(icon => {
    const btn = document.createElement('button');
    btn.className = 'reaction-btn';
    btn.textContent = icon;
    reactions.appendChild(btn);
  });
  messageEl.appendChild(reactions);

  messagesEl.appendChild(messageEl);
  scrollToBottom();
}

function renderFormattedContent(container, text) {
  const paragraphs = text.split('\n\n').map(p => p.trim()).filter(Boolean);

  paragraphs.forEach(paraText => {
    const lines = paraText.split('\n');
    const isList = lines.every(l => l.trim().startsWith('- ') || l.trim().startsWith('\u2022 ') || l.trim() === '');

    if (isList && lines.filter(l => l.trim()).length > 1) {
      const ul = document.createElement('ul');
      lines.forEach(line => {
        const trimmed = line.trim();
        if (trimmed.startsWith('- ') || trimmed.startsWith('\u2022 ')) {
          const li = document.createElement('li');
          renderInline(li, trimmed.substring(2));
          ul.appendChild(li);
        }
      });
      container.appendChild(ul);
    } else {
      const p = document.createElement('p');
      renderInline(p, paraText);
      container.appendChild(p);
    }
  });
}

function renderInline(element, text) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  parts.forEach(part => {
    if (part.startsWith('**') && part.endsWith('**')) {
      const strong = document.createElement('strong');
      strong.textContent = part.slice(2, -2);
      element.appendChild(strong);
    } else {
      const lines = part.split('\n');
      lines.forEach((line, i) => {
        element.appendChild(document.createTextNode(line));
        if (i < lines.length - 1) {
          element.appendChild(document.createElement('br'));
        }
      });
    }
  });
}

function showThinking() {
  const el = document.createElement('div');
  el.className = 'thinking-indicator';
  const img = document.createElement('img');
  img.src = 'https://cdn.jsdelivr.net/gh/homarr-labs/dashboard-icons/png/anthropic.png';
  img.alt = 'Thinking';
  img.width = 24;
  img.height = 24;
  el.appendChild(img);
  messagesEl.appendChild(el);
  scrollToBottom();
  return el;
}

function scrollToBottom() {
  chatContainer.scrollTop = chatContainer.scrollHeight;
}

function setHelpButtonState(label, loading) {
  if (!helpLauncherBtn) return;
  helpLauncherBtn.title = label;
  helpLauncherBtn.setAttribute('aria-label', label);
  helpLauncherBtn.classList.toggle('loading', loading);
  helpLauncherBtn.disabled = loading;
}

function setHelpStatus(text) {
  if (helpStatusText) {
    helpStatusText.textContent = text;
  }
}

function setHelpView(mode) {
  if (!helpHomeView || !helpThreadView) return;
  const showThread = mode === 'thread';
  helpHomeView.hidden = showThread;
  helpThreadView.hidden = !showThread;
}

function openProfileMenu() {
  if (!profileMenu || !profileMenuTrigger) return;
  profileMenu.classList.add('open');
  profileMenu.setAttribute('aria-hidden', 'false');
  profileMenuTrigger.setAttribute('aria-expanded', 'true');
  isProfileMenuOpen = true;
}

function closeProfileMenu() {
  if (!profileMenu || !profileMenuTrigger) return;
  profileMenu.classList.remove('open');
  profileMenu.setAttribute('aria-hidden', 'true');
  profileMenuTrigger.setAttribute('aria-expanded', 'false');
  isProfileMenuOpen = false;
}

function toggleProfileMenu() {
  if (isProfileMenuOpen) {
    closeProfileMenu();
  } else {
    openProfileMenu();
  }
}

function setHelpTyping(isVisible) {
  if (!helpMessages) return;

  const existing = helpMessages.querySelector('.help-typing-row');
  if (!isVisible) {
    if (existing) existing.remove();
    return;
  }

  if (existing) return;

  const row = document.createElement('div');
  row.className = 'help-entry agent help-typing-row';

  const bubble = document.createElement('div');
  bubble.className = 'help-entry-bubble help-typing-bubble';

  for (let i = 0; i < 3; i += 1) {
    const dot = document.createElement('span');
    dot.className = 'typing-dot';
    bubble.appendChild(dot);
  }

  const text = document.createElement('span');
  text.className = 'typing-text';
  text.textContent = 'Claudia is typing...';
  bubble.appendChild(text);

  row.appendChild(bubble);
  helpMessages.appendChild(row);
  helpMessages.scrollTop = helpMessages.scrollHeight;
}

function appendHelpEntry(role, text) {
  if (!helpMessages || !text) return;
  const row = document.createElement('div');
  row.className = `help-entry ${role}`;
  const bubble = document.createElement('div');
  bubble.className = 'help-entry-bubble';
  bubble.textContent = text;
  row.appendChild(bubble);
  helpMessages.appendChild(row);
  helpMessages.scrollTop = helpMessages.scrollHeight;
}

function renderHelpEntries(entries) {
  if (!entries || !Array.isArray(entries)) return;
  entries.forEach(entry => {
    if (!entry.id || helpRenderedIds.has(entry.id)) return;
    helpRenderedIds.add(entry.id);
    const senderRole = String(entry.senderRole || '').toLowerCase();
    const role = senderRole === 'enduser' ? 'user' : 'agent';
    if (role === 'user') {
      const pendingIndex = pendingUserMessages.findIndex(msg => msg === entry.text);
      if (pendingIndex !== -1) {
        pendingUserMessages.splice(pendingIndex, 1);
        return;
      }
    }
    appendHelpEntry(role, entry.text);
    if (role === 'agent') {
      awaitingAgentReply = false;
      setHelpTyping(false);
    }
  });
}

async function initializeHelpSession() {
  const response = await fetch('/api/messaging/session', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  });
  const data = await response.json();
  if (!response.ok || data.error) {
    throw new Error(data.error || 'Failed to start help session.');
  }
  helpSession = data;
  setHelpStatus('Connected to Claudia');
}

async function fetchHelpMessages() {
  if (!helpSession) return;
  const response = await fetch('/api/messaging/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      accessToken: helpSession.accessToken,
      conversationId: helpSession.conversationId
    })
  });
  const data = await response.json();
  if (!response.ok || data.error) {
    throw new Error(data.error || 'Failed to load help messages.');
  }
  renderHelpEntries(data.entries || []);
}

async function sendHelpMessage() {
  const text = helpInput.value.trim();
  if (!text || !helpSession || isHelpLoading) return;

  isHelpLoading = true;
  setHelpButtonState('Sending help message', true);
  helpSendBtn.disabled = true;

  try {
    appendHelpEntry('user', text);
    pendingUserMessages.push(text);
    helpInput.value = '';
    helpInput.style.height = 'auto';

    const response = await fetch('/api/messaging/message', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        accessToken: helpSession.accessToken,
        conversationId: helpSession.conversationId,
        message: text
      })
    });
    const data = await response.json();
    if (!response.ok || data.error) {
      throw new Error(data.error || 'Failed to send help message.');
    }
    awaitingAgentReply = true;
    setHelpTyping(true);
    await fetchHelpMessages();
  } catch (err) {
    console.error('Help message send failed:', err);
    setHelpStatus('Failed to send message');
    appendHelpEntry('agent', 'Sorry, I could not send that message. Please try again.');
  } finally {
    isHelpLoading = false;
    setHelpButtonState(isHelpOpen ? 'Close Help' : 'Open Salesforce Help chat', false);
    helpSendBtn.disabled = !helpInput.value.trim();
  }
}

function startHelpPolling() {
  stopHelpPolling();
  helpPollingId = setInterval(async () => {
    if (!isHelpOpen || !helpSession) return;
    try {
      await fetchHelpMessages();
    } catch (err) {
      console.error('Help polling failed:', err);
    }
  }, 3000);
}

function stopHelpPolling() {
  if (helpPollingId) {
    clearInterval(helpPollingId);
    helpPollingId = null;
  }
}

function closeHelpMenu() {
  if (!helpMenu || !helpMenuBtn) return;
  helpMenu.classList.remove('open');
  helpMenu.setAttribute('aria-hidden', 'true');
  helpMenuBtn.setAttribute('aria-expanded', 'false');
}

function toggleHelpMenu() {
  if (!helpMenu || !helpMenuBtn) return;
  const shouldOpen = !helpMenu.classList.contains('open');
  if (shouldOpen) {
    helpMenu.classList.add('open');
    helpMenu.setAttribute('aria-hidden', 'false');
    helpMenuBtn.setAttribute('aria-expanded', 'true');
  } else {
    closeHelpMenu();
  }
}

function resetHelpConversationState() {
  helpSession = null;
  awaitingAgentReply = false;
  helpRenderedIds.clear();
  pendingUserMessages.length = 0;
  setHelpTyping(false);
  setHelpView('home');
  if (helpMessages) {
    helpMessages.textContent = '';
  }
  closeHelpMenu();
  if (helpInput) {
    helpInput.value = '';
    helpInput.style.height = 'auto';
  }
  if (helpSendBtn) {
    helpSendBtn.disabled = true;
  }
  setHelpStatus('Start a conversation with Claudia');
}

async function endHelpConversation() {
  if (!helpSession || isHelpLoading) {
    closeHelpDrawer();
    return;
  }

  isHelpLoading = true;
  setHelpButtonState('Ending conversation', true);
  setHelpStatus('Ending conversation...');
  if (helpEndBtn) helpEndBtn.disabled = true;

  try {
    const response = await fetch('/api/messaging/end', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        accessToken: helpSession.accessToken,
        conversationId: helpSession.conversationId
      })
    });
    const data = await response.json();
    if (!response.ok || data.error) {
      throw new Error(data.error || 'Failed to end conversation.');
    }
  } catch (err) {
    console.error('Help end conversation failed:', err);
    setHelpStatus('Could not end conversation cleanly');
  } finally {
    stopHelpPolling();
    resetHelpConversationState();
    closeHelpDrawer();
    if (helpEndBtn) helpEndBtn.disabled = false;
    isHelpLoading = false;
    setHelpButtonState('Open Salesforce Help chat', false);
  }
}

function closeHelpDrawer() {
  isHelpOpen = false;
  awaitingAgentReply = false;
  closeHelpMenu();
  closeProfileMenu();
  setHelpTyping(false);
  setHelpView('home');
  if (helpDrawer) {
    helpDrawer.classList.remove('open');
    helpDrawer.setAttribute('aria-hidden', 'true');
  }
  if (helpLauncherBtn) helpLauncherBtn.classList.remove('active');
  setHelpButtonState('Open Salesforce Help chat', false);
  stopHelpPolling();
}

async function openHelpDrawer() {
  isHelpOpen = true;
  if (helpDrawer) {
    helpDrawer.classList.add('open');
    helpDrawer.setAttribute('aria-hidden', 'false');
  }
  if (helpLauncherBtn) helpLauncherBtn.classList.add('active');
  setHelpView('home');
}

async function openHelpThread() {
  setHelpView('thread');
  setHelpStatus('Connecting to Claudia...');
  if (!helpSession) {
    await initializeHelpSession();
  }
  setHelpTyping(awaitingAgentReply);
  await fetchHelpMessages();
  if (helpEndBtn) helpEndBtn.disabled = false;
  startHelpPolling();
}

async function launchHelpChat() {
  if (isHelpLoading) return;
  isHelpLoading = true;
  setHelpButtonState(isHelpOpen ? 'Closing help' : 'Opening help', true);

  try {
    if (isHelpOpen) {
      closeHelpDrawer();
    } else {
      await openHelpDrawer();
    }
  } catch (err) {
    console.error('Help chat failed:', err);
    setHelpStatus('Unable to connect right now');
    setHelpButtonState('Retry Help', false);
  } finally {
    isHelpLoading = false;
    if (!helpLauncherBtn.classList.contains('loading')) {
      setHelpButtonState(isHelpOpen ? 'Close Help' : 'Open Salesforce Help chat', false);
    }
  }
}

if (helpLauncherBtn) {
  helpLauncherBtn.addEventListener('click', launchHelpChat);
}

if (profileMenuTrigger) {
  profileMenuTrigger.addEventListener('click', e => {
    e.stopPropagation();
    toggleProfileMenu();
  });
}

if (profileGetHelpBtn) {
  profileGetHelpBtn.addEventListener('click', async e => {
    e.stopPropagation();
    closeProfileMenu();
    await openHelpDrawer();
  });
}

if (helpCloseBtn) {
  helpCloseBtn.addEventListener('click', closeHelpDrawer);
}

if (helpMenuBtn) {
  helpMenuBtn.addEventListener('click', e => {
    e.stopPropagation();
    toggleHelpMenu();
  });
}

if (helpEndBtn) {
  helpEndBtn.addEventListener('click', async () => {
    closeHelpMenu();
    await endHelpConversation();
  });
}

document.addEventListener('click', e => {
  if (!helpMenu || !helpMenuBtn) return;
  if (!helpMenu.contains(e.target) && !helpMenuBtn.contains(e.target)) {
    closeHelpMenu();
  }
});

document.addEventListener('click', e => {
  if (!profileMenu || !profileMenuTrigger || !profileMenuWrap) return;
  if (!profileMenuWrap.contains(e.target) && !profileMenuTrigger.contains(e.target)) {
    closeProfileMenu();
  }
});

if (helpSendMessageCta) {
  helpSendMessageCta.addEventListener('click', async () => {
    try {
      await openHelpThread();
    } catch (err) {
      console.error('Failed to open help thread:', err);
      setHelpStatus('Unable to connect right now');
      setHelpView('home');
    }
  });
}

if (helpInput && helpSendBtn) {
  helpInput.addEventListener('input', () => {
    helpInput.style.height = 'auto';
    helpInput.style.height = Math.min(helpInput.scrollHeight, 120) + 'px';
    helpSendBtn.disabled = !helpInput.value.trim() || !helpSession || isHelpLoading;
  });

  helpInput.addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (helpInput.value.trim() && helpSession && !isHelpLoading) {
        sendHelpMessage();
      }
    }
  });

  helpSendBtn.addEventListener('click', sendHelpMessage);
}
