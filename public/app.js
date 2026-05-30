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

let conversationHistory = [];
let isWaiting = false;
let inConversation = false;

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
