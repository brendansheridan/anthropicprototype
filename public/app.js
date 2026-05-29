const messagesEl = document.getElementById('messages');
const messageInput = document.getElementById('messageInput');
const sendBtn = document.getElementById('sendBtn');
const newChatBtn = document.getElementById('newChatBtn');
const welcomeEl = document.getElementById('welcome');

let conversationHistory = [];
let isWaiting = false;

// Auto-resize textarea
messageInput.addEventListener('input', () => {
  messageInput.style.height = 'auto';
  messageInput.style.height = Math.min(messageInput.scrollHeight, 200) + 'px';
  sendBtn.disabled = !messageInput.value.trim();
});

// Send on Enter (Shift+Enter for newline)
messageInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    if (messageInput.value.trim() && !isWaiting) {
      sendMessage();
    }
  }
});

sendBtn.addEventListener('click', () => {
  if (messageInput.value.trim() && !isWaiting) {
    sendMessage();
  }
});

// Suggestion chips
document.querySelectorAll('.suggestion-chip').forEach(chip => {
  chip.addEventListener('click', () => {
    messageInput.value = chip.dataset.message;
    sendBtn.disabled = false;
    sendMessage();
  });
});

// New chat
newChatBtn.addEventListener('click', () => {
  conversationHistory = [];
  messagesEl.textContent = '';
  messagesEl.appendChild(welcomeEl);
  welcomeEl.style.display = 'flex';
  messageInput.value = '';
  sendBtn.disabled = true;
});

async function sendMessage() {
  const message = messageInput.value.trim();
  if (!message || isWaiting) return;

  // Hide welcome
  if (welcomeEl) {
    welcomeEl.style.display = 'none';
  }

  // Add user message to UI
  appendMessage('user', message);
  conversationHistory.push({ role: 'user', content: message });

  // Clear input
  messageInput.value = '';
  messageInput.style.height = 'auto';
  sendBtn.disabled = true;
  isWaiting = true;

  // Show typing indicator
  const typingEl = showTyping();

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

    // Remove typing indicator
    typingEl.remove();

    if (data.error) {
      appendMessage('assistant', 'I apologize, but I encountered an error. Please try again.');
    } else {
      appendMessage('assistant', data.response, data.actions);
      conversationHistory.push({
        role: 'assistant',
        content: data.response,
        state: data.conversationState
      });
    }
  } catch (err) {
    typingEl.remove();
    appendMessage('assistant', 'I apologize, but I\'m having trouble connecting to the server. Please check your connection and try again.');
  }

  isWaiting = false;
  scrollToBottom();
}

function appendMessage(role, content, actions) {
  const messageEl = document.createElement('div');
  messageEl.className = 'message';

  // Header
  const headerEl = document.createElement('div');
  headerEl.className = 'message-header';

  const avatarEl = document.createElement('div');
  avatarEl.className = 'message-avatar ' + role;
  avatarEl.textContent = role === 'user' ? 'Y' : 'C';

  const senderEl = document.createElement('span');
  senderEl.className = 'message-sender';
  senderEl.textContent = role === 'user' ? 'You' : 'Claude';

  headerEl.appendChild(avatarEl);
  headerEl.appendChild(senderEl);

  // Content
  const contentEl = document.createElement('div');
  contentEl.className = 'message-content';
  renderFormattedContent(contentEl, content);

  // Actions badges
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

  messageEl.appendChild(headerEl);
  messageEl.appendChild(contentEl);
  messagesEl.appendChild(messageEl);
  scrollToBottom();
}

/**
 * Renders formatted text content safely using DOM APIs.
 * Supports **bold** and paragraph splitting.
 */
function renderFormattedContent(container, text) {
  const paragraphs = text.split('\n\n').map(p => p.trim()).filter(Boolean);

  paragraphs.forEach(paraText => {
    const p = document.createElement('p');
    // Split by **bold** markers
    const parts = paraText.split(/(\*\*[^*]+\*\*)/g);
    parts.forEach(part => {
      if (part.startsWith('**') && part.endsWith('**')) {
        const strong = document.createElement('strong');
        strong.textContent = part.slice(2, -2);
        p.appendChild(strong);
      } else {
        // Handle line breaks within paragraph
        const lines = part.split('\n');
        lines.forEach((line, i) => {
          p.appendChild(document.createTextNode(line));
          if (i < lines.length - 1) {
            p.appendChild(document.createElement('br'));
          }
        });
      }
    });
    container.appendChild(p);
  });
}

function showTyping() {
  const typingEl = document.createElement('div');
  typingEl.className = 'typing-indicator';
  for (let i = 0; i < 3; i++) {
    typingEl.appendChild(document.createElement('span'));
  }
  messagesEl.appendChild(typingEl);
  scrollToBottom();
  return typingEl;
}

function scrollToBottom() {
  const container = document.querySelector('.chat-container');
  container.scrollTop = container.scrollHeight;
}
