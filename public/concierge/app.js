const welcomeSection = document.getElementById('welcomeSection');
const chatSection = document.getElementById('chatSection');
const chatMessages = document.getElementById('chatMessages');
const chatInput = document.getElementById('chatInput');
const chatSendBtn = document.getElementById('chatSendBtn');
const searchInput = document.getElementById('searchInput');
const searchSubmit = document.getElementById('searchSubmit');

let conversationHistory = [];
let isWaiting = false;

// Category buttons
document.querySelectorAll('.category-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    startChat(btn.dataset.message);
  });
});

// Search bar
searchSubmit.addEventListener('click', () => {
  if (searchInput.value.trim()) {
    startChat(searchInput.value.trim());
  }
});

searchInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && searchInput.value.trim()) {
    startChat(searchInput.value.trim());
  }
});

// Chat input
chatInput.addEventListener('input', () => {
  chatSendBtn.disabled = !chatInput.value.trim();
});

chatInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && chatInput.value.trim() && !isWaiting) {
    sendMessage(chatInput.value.trim());
    chatInput.value = '';
    chatSendBtn.disabled = true;
  }
});

chatSendBtn.addEventListener('click', () => {
  if (chatInput.value.trim() && !isWaiting) {
    sendMessage(chatInput.value.trim());
    chatInput.value = '';
    chatSendBtn.disabled = true;
  }
});

function startChat(message) {
  welcomeSection.classList.add('hidden');
  chatSection.classList.add('visible');
  chatInput.focus();
  sendMessage(message);
}

async function sendMessage(message) {
  if (!message || isWaiting) return;

  appendUserMessage(message);
  conversationHistory.push({ role: 'user', content: message });
  isWaiting = true;

  const typingEl = showTyping();

  try {
    const response = await fetch('/api/concierge/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message, conversationHistory })
    });

    const data = await response.json();
    typingEl.remove();

    appendAssistantMessage(data.response, data.card);
    conversationHistory.push({
      role: 'assistant',
      content: data.response,
      state: data.conversationState
    });
  } catch (err) {
    typingEl.remove();
    appendAssistantMessage('Sorry, I encountered an error. Please try again.', null);
  }

  isWaiting = false;
  scrollToBottom();
}

function appendUserMessage(content) {
  const msg = document.createElement('div');
  msg.className = 'msg msg-user';
  const bubble = document.createElement('div');
  bubble.className = 'msg-bubble';
  bubble.textContent = content;
  msg.appendChild(bubble);
  chatMessages.appendChild(msg);
  scrollToBottom();
}

function appendAssistantMessage(content, card) {
  const msg = document.createElement('div');
  msg.className = 'msg msg-assistant';

  // Text
  const textEl = document.createElement('div');
  textEl.className = 'msg-text';
  renderText(textEl, content);
  msg.appendChild(textEl);

  // Card
  if (card) {
    const cardEl = renderCard(card);
    if (cardEl) msg.appendChild(cardEl);
  }

  chatMessages.appendChild(msg);
  scrollToBottom();
}

function renderText(container, text) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  parts.forEach(part => {
    if (part.startsWith('**') && part.endsWith('**')) {
      const strong = document.createElement('strong');
      strong.textContent = part.slice(2, -2);
      container.appendChild(strong);
    } else {
      container.appendChild(document.createTextNode(part));
    }
  });
}

function renderCard(card) {
  switch (card.type) {
    case 'billing_summary': return renderBillingCard(card.data);
    case 'api_usage': return renderUsageCard(card.data);
    case 'plan_comparison': return renderPlanCard(card.data);
    case 'upgrade_confirmation': return renderConfirmCard(card.data);
    default: return null;
  }
}

function renderBillingCard(data) {
  const card = document.createElement('div');
  card.className = 'card';

  const header = document.createElement('div');
  header.className = 'card-header';
  const title = document.createElement('span');
  title.className = 'card-title';
  title.textContent = 'Billing Summary';
  const badge = document.createElement('span');
  badge.className = 'card-badge badge-active';
  badge.textContent = 'Active';
  header.appendChild(title);
  header.appendChild(badge);

  const body = document.createElement('div');
  body.className = 'card-body';
  const grid = document.createElement('div');
  grid.className = 'billing-grid';

  const items = [
    { label: 'Current Plan', value: data.plan, large: false },
    { label: 'Monthly Rate', value: data.monthlyRate, large: true },
    { label: 'Next Billing', value: data.nextBilling, large: false },
    { label: 'Payment Method', value: data.paymentMethod, large: false },
  ];

  items.forEach(item => {
    const el = document.createElement('div');
    el.className = 'billing-item';
    const label = document.createElement('div');
    label.className = 'billing-label';
    label.textContent = item.label;
    const value = document.createElement('div');
    value.className = 'billing-value' + (item.large ? ' large' : '');
    value.textContent = item.value;
    el.appendChild(label);
    el.appendChild(value);
    grid.appendChild(el);
  });

  body.appendChild(grid);

  // Usage progress
  const progressLabel = document.createElement('div');
  progressLabel.className = 'billing-label';
  progressLabel.textContent = 'Current period usage: ' + data.currentUsage + ' (' + data.usagePercent + '%)';
  progressLabel.style.marginTop = '16px';
  body.appendChild(progressLabel);

  const progress = document.createElement('div');
  progress.className = 'progress-bar';
  const fill = document.createElement('div');
  fill.className = 'progress-fill ' + (data.usagePercent > 80 ? 'warning' : 'ok');
  fill.style.width = data.usagePercent + '%';
  progress.appendChild(fill);
  body.appendChild(progress);

  card.appendChild(header);
  card.appendChild(body);
  return card;
}

function renderUsageCard(data) {
  const card = document.createElement('div');
  card.className = 'card';

  const header = document.createElement('div');
  header.className = 'card-header';
  const title = document.createElement('span');
  title.className = 'card-title';
  title.textContent = 'API Usage — Last 7 Days';
  const badge = document.createElement('span');
  badge.className = 'card-badge badge-warning';
  badge.textContent = data.rateLimitUsed + '% of limit';
  header.appendChild(title);
  header.appendChild(badge);

  const body = document.createElement('div');
  body.className = 'card-body';

  // Stats
  const stats = document.createElement('div');
  stats.className = 'usage-stats';
  [
    { value: data.dailyRequests, label: 'Avg Requests/Day' },
    { value: data.totalTokens, label: 'Total Tokens' },
    { value: data.avgLatency, label: 'Avg Latency' }
  ].forEach(s => {
    const stat = document.createElement('div');
    stat.className = 'usage-stat';
    const val = document.createElement('div');
    val.className = 'usage-stat-value';
    val.textContent = s.value;
    const lbl = document.createElement('div');
    lbl.className = 'usage-stat-label';
    lbl.textContent = s.label;
    stat.appendChild(val);
    stat.appendChild(lbl);
    stats.appendChild(stat);
  });
  body.appendChild(stats);

  // Chart
  const chart = document.createElement('div');
  chart.className = 'usage-chart';
  const maxVal = Math.max(...data.days.map(d => d.value));
  data.days.forEach(day => {
    const group = document.createElement('div');
    group.className = 'usage-bar-group';
    const bar = document.createElement('div');
    bar.className = 'usage-bar';
    bar.style.height = Math.round((day.value / maxVal) * 60) + 'px';
    const label = document.createElement('div');
    label.className = 'usage-bar-label';
    label.textContent = day.label;
    group.appendChild(bar);
    group.appendChild(label);
    chart.appendChild(group);
  });
  body.appendChild(chart);

  // Rate limit progress
  const progressLabel = document.createElement('div');
  progressLabel.className = 'billing-label';
  progressLabel.textContent = 'Rate limit: ' + data.rateLimit + ' (peak at ' + data.peakHour + ')';
  progressLabel.style.marginTop = '12px';
  body.appendChild(progressLabel);
  const progress = document.createElement('div');
  progress.className = 'progress-bar';
  const fill = document.createElement('div');
  fill.className = 'progress-fill warning';
  fill.style.width = data.rateLimitUsed + '%';
  progress.appendChild(fill);
  body.appendChild(progress);

  card.appendChild(header);
  card.appendChild(body);
  return card;
}

function renderPlanCard(data) {
  const card = document.createElement('div');
  card.className = 'card';

  const header = document.createElement('div');
  header.className = 'card-header';
  const title = document.createElement('span');
  title.className = 'card-title';
  title.textContent = 'Plan Comparison';
  const badge = document.createElement('span');
  badge.className = 'card-badge badge-info';
  badge.textContent = 'Upgrade Available';
  header.appendChild(title);
  header.appendChild(badge);

  const body = document.createElement('div');
  body.className = 'card-body';

  const grid = document.createElement('div');
  grid.className = 'plan-grid';

  [data.current, data.recommended].forEach(plan => {
    const col = document.createElement('div');
    col.className = 'plan-col' + (plan.highlight ? ' recommended' : '');

    const name = document.createElement('div');
    name.className = 'plan-name';
    name.textContent = plan.name;

    const price = document.createElement('div');
    price.className = 'plan-price';
    price.textContent = plan.price;

    const features = document.createElement('ul');
    features.className = 'plan-features';
    [
      plan.rateLimit + ' rate limit',
      plan.tokens + ' included',
      plan.support + ' support',
      plan.models + ' models'
    ].forEach(f => {
      const li = document.createElement('li');
      li.textContent = f;
      features.appendChild(li);
    });

    col.appendChild(name);
    col.appendChild(price);
    col.appendChild(features);
    grid.appendChild(col);
  });

  body.appendChild(grid);

  // Savings note
  const savings = document.createElement('div');
  savings.className = 'plan-savings';
  savings.textContent = data.savings;
  body.appendChild(savings);

  // Upgrade button
  const btn = document.createElement('button');
  btn.className = 'upgrade-btn';
  btn.textContent = 'Upgrade to Scale';
  btn.addEventListener('click', () => {
    sendMessage('Yes, upgrade me to the Scale plan');
  });
  body.appendChild(btn);

  card.appendChild(header);
  card.appendChild(body);
  return card;
}

function renderConfirmCard(data) {
  const card = document.createElement('div');
  card.className = 'card';

  const header = document.createElement('div');
  header.className = 'card-header';
  const title = document.createElement('span');
  title.className = 'card-title';
  title.textContent = 'Upgrade Confirmed';
  const badge = document.createElement('span');
  badge.className = 'card-badge badge-success';
  badge.textContent = 'Complete';
  header.appendChild(title);
  header.appendChild(badge);

  const body = document.createElement('div');
  body.className = 'card-body';

  const content = document.createElement('div');
  content.className = 'confirm-content';

  const icon = document.createElement('div');
  icon.className = 'confirm-icon';
  icon.textContent = '\u2713';

  const titleEl = document.createElement('div');
  titleEl.className = 'confirm-title';
  titleEl.textContent = 'Welcome to ' + data.plan + '!';

  const details = document.createElement('div');
  details.className = 'confirm-details';
  [
    { label: 'Plan', value: data.plan },
    { label: 'Effective', value: data.effectiveDate },
    { label: 'Rate Limit', value: data.newRateLimit },
    { label: 'Token Allowance', value: data.newTokens },
    { label: 'Next Billing', value: data.nextBilling }
  ].forEach(d => {
    const row = document.createElement('div');
    row.className = 'confirm-detail';
    const lbl = document.createElement('span');
    lbl.className = 'confirm-detail-label';
    lbl.textContent = d.label;
    const val = document.createElement('span');
    val.className = 'confirm-detail-value';
    val.textContent = d.value;
    row.appendChild(lbl);
    row.appendChild(val);
    details.appendChild(row);
  });

  content.appendChild(icon);
  content.appendChild(titleEl);
  content.appendChild(details);
  body.appendChild(content);

  card.appendChild(header);
  card.appendChild(body);
  return card;
}

function showTyping() {
  const el = document.createElement('div');
  el.className = 'msg msg-assistant';
  const dots = document.createElement('div');
  dots.className = 'typing-dots';
  for (let i = 0; i < 3; i++) dots.appendChild(document.createElement('span'));
  el.appendChild(dots);
  chatMessages.appendChild(el);
  scrollToBottom();
  return el;
}

function scrollToBottom() {
  chatMessages.scrollTop = chatMessages.scrollHeight;
}
