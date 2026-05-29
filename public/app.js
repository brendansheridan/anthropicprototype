const messagesEl = document.getElementById('messages');
const messageInput = document.getElementById('messageInput');
const sendBtn = document.getElementById('sendBtn');
const newChatBtn = document.getElementById('newChatBtn');
const welcomeEl = document.getElementById('welcome');
const suggestionsEl = document.getElementById('suggestions');
const chatTitleText = document.getElementById('chatTitleText');

let conversationHistory = [];
let isWaiting = false;
let firstMessage = true;

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
  firstMessage = true;
  messagesEl.textContent = '';
  messagesEl.appendChild(welcomeEl);
  welcomeEl.style.display = 'flex';
  suggestionsEl.style.display = 'flex';
  chatTitleText.textContent = 'New chat';
  messageInput.value = '';
  messageInput.placeholder = 'How can I help you today?';
  sendBtn.disabled = true;
});

async function sendMessage() {
  const message = messageInput.value.trim();
  if (!message || isWaiting) return;

  // Hide welcome and suggestions
  if (welcomeEl) {
    welcomeEl.style.display = 'none';
  }
  if (suggestionsEl) {
    suggestionsEl.style.display = 'none';
  }

  // Update title and placeholder on first message
  if (firstMessage) {
    chatTitleText.textContent = message.length > 35 ? message.substring(0, 32) + '...' : message;
    messageInput.placeholder = 'Write a message...';
    firstMessage = false;
  }

  // Add user message to UI
  appendUserMessage(message);
  conversationHistory.push({ role: 'user', content: message });

  // Clear input
  messageInput.value = '';
  messageInput.style.height = 'auto';
  sendBtn.disabled = true;
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

    // Remove thinking indicator
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
    appendAssistantMessage('I apologize, but I\'m having trouble connecting to the server. Please check your connection and try again.');
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

  // Content
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
  const icons = ['copy', 'thumbsup', 'thumbsdown', 'retry'];
  const svgs = {
    copy: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>',
    thumbsup: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"/></svg>',
    thumbsdown: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10 15v4a3 3 0 0 0 3 3l4-9V2H5.72a2 2 0 0 0-2 1.7l-1.38 9a2 2 0 0 0 2 2.3zm7-13h2.67A2.31 2.31 0 0 1 22 4v7a2.31 2.31 0 0 1-2.33 2H17"/></svg>',
    retry: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>'
  };
  icons.forEach(icon => {
    const btn = document.createElement('button');
    btn.className = 'reaction-btn';
    btn.title = icon;
    // Use a text fallback since we can't use innerHTML
    btn.textContent = icon === 'copy' ? '\u2398' : icon === 'thumbsup' ? '\u{1F44D}' : icon === 'thumbsdown' ? '\u{1F44E}' : '\u21BB';
    btn.style.fontSize = '12px';
    reactions.appendChild(btn);
  });
  messageEl.appendChild(reactions);

  messagesEl.appendChild(messageEl);
  scrollToBottom();
}

/**
 * Renders formatted text content safely using DOM APIs.
 * Supports **bold**, bullet lists, and paragraph splitting.
 */
function renderFormattedContent(container, text) {
  const paragraphs = text.split('\n\n').map(p => p.trim()).filter(Boolean);

  paragraphs.forEach(paraText => {
    // Check if this is a bullet list
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
  // Split by **bold** markers
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  parts.forEach(part => {
    if (part.startsWith('**') && part.endsWith('**')) {
      const strong = document.createElement('strong');
      strong.textContent = part.slice(2, -2);
      element.appendChild(strong);
    } else {
      // Handle line breaks
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
  // Coral sparkle SVG as thinking indicator
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('width', '24');
  svg.setAttribute('height', '24');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('fill', 'none');
  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  path.setAttribute('d', 'M12 2L13.5 8.5L20 7L15 12L20 17L13.5 15.5L12 22L10.5 15.5L4 17L9 12L4 7L10.5 8.5L12 2Z');
  path.setAttribute('fill', '#d4856a');
  path.setAttribute('stroke', '#d4856a');
  path.setAttribute('stroke-width', '0.5');
  svg.appendChild(path);
  el.appendChild(svg);
  messagesEl.appendChild(el);
  scrollToBottom();
  return el;
}

function scrollToBottom() {
  const container = document.querySelector('.chat-container');
  container.scrollTop = container.scrollHeight;
}
