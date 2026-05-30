/**
 * Concierge 2.0 — Scripted typewriter conversation.
 * Press SPACEBAR to advance to the next turn.
 * Each turn: user message types out → agent responds with text + card.
 */

const welcomeSection = document.getElementById('welcomeSection');
const chatSection = document.getElementById('chatSection');
const chatMessages = document.getElementById('chatMessages');
const chatInput = document.getElementById('chatInput');
const chatSendBtn = document.getElementById('chatSendBtn');
const searchInput = document.getElementById('searchInput');
const searchSubmit = document.getElementById('searchSubmit');

// Scripted conversation turns
const SCRIPT = [
  {
    user: "Can you show me my current billing and plan details?",
    agent: "Of course! Here\u2019s your current billing summary. You\u2019re on the **Team plan** at $599/month with your next billing cycle on June 15th. You\u2019ve used about 81% of your included allocation so far this period.",
    card: {
      type: 'billing_summary',
      data: {
        plan: 'Team',
        monthlyRate: '$599',
        nextBilling: 'June 15, 2026',
        paymentMethod: 'Visa ending in 4242',
        currentUsage: '$487.32',
        usagePercent: 81
      }
    }
  },
  {
    user: "I've been hitting some rate limits lately. Can you show me my API usage?",
    agent: "I can see you\u2019re hitting **87% of your rate limit** during peak hours, especially around 2 PM UTC. Your average daily request volume has been climbing steadily this week. Here\u2019s the full breakdown:",
    card: {
      type: 'api_usage',
      data: {
        dailyRequests: '14,832',
        totalTokens: '2.4M',
        avgLatency: '1.2s',
        rateLimit: '1,000 RPM',
        rateLimitUsed: 87,
        peakHour: '2:00 PM UTC',
        days: [
          { label: 'Mon', value: 12400 },
          { label: 'Tue', value: 13100 },
          { label: 'Wed', value: 14832 },
          { label: 'Thu', value: 11900 },
          { label: 'Fri', value: 13600 },
          { label: 'Sat', value: 8200 },
          { label: 'Sun', value: 7100 }
        ]
      }
    }
  },
  {
    user: "What are my options for getting higher rate limits? Is there an upgrade path?",
    agent: "Based on your usage patterns, I\u2019d recommend the **Scale plan**. You\u2019re regularly hitting rate limits which is adding latency to your production requests. Scale gives you 5x the throughput, access to Opus, and priority support. Here\u2019s how they compare:",
    card: {
      type: 'plan_comparison',
      data: {
        current: {
          name: 'Team',
          price: '$599/mo',
          rateLimit: '1,000 RPM',
          tokens: '5M tokens/mo',
          support: 'Standard',
          models: 'Sonnet, Haiku'
        },
        recommended: {
          name: 'Scale',
          price: '$1,499/mo',
          rateLimit: '5,000 RPM',
          tokens: '25M tokens/mo',
          support: 'Priority 24/7',
          models: 'Opus, Sonnet, Haiku',
          highlight: true
        },
        savings: 'Based on your usage, Scale would eliminate all rate-limit delays and save ~4.2 engineering hours/week in retry handling.'
      }
    }
  },
  {
    user: "That looks good. Let's go ahead and upgrade to Scale.",
    agent: "Done! Your upgrade to the **Scale plan** has been processed and the new limits are active immediately. You should see the rate-limit pressure drop right away. Welcome to Scale! \uD83C\uDF89",
    card: {
      type: 'upgrade_confirmation',
      data: {
        plan: 'Scale',
        effectiveDate: 'Immediately',
        newRateLimit: '5,000 RPM',
        newTokens: '25M tokens/mo',
        nextBilling: 'June 15, 2026 \u2014 $1,499'
      }
    }
  },
  {
    user: "Great, thanks! Can you also show me how to rotate my API keys?",
    agent: "Absolutely! You can rotate your API keys from the **API Settings** page. I\u2019d recommend creating a new key first, updating your environment variables, verifying everything works, then revoking the old key. Would you like me to walk you through that step by step, or open the API Settings page for you?",
    card: null
  }
];

let currentTurn = -1;
let isAnimating = false;
let conversationStarted = false;

// Category buttons start the conversation
document.querySelectorAll('.category-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    startConversation();
  });
});

// Search bar starts the conversation
searchSubmit.addEventListener('click', () => {
  startConversation();
});

searchInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    startConversation();
  }
});

// SPACEBAR advances the script
document.addEventListener('keydown', (e) => {
  if (e.code === 'Space' && conversationStarted && !isAnimating) {
    e.preventDefault();
    advanceTurn();
  }
});

// Also allow clicking the input area hint to advance
chatInput.addEventListener('focus', () => {
  if (conversationStarted && !isAnimating && currentTurn < SCRIPT.length - 1) {
    chatInput.placeholder = 'Press SPACE to continue the conversation...';
  }
});

function startConversation() {
  welcomeSection.classList.add('hidden');
  chatSection.classList.add('visible');
  conversationStarted = true;
  chatInput.placeholder = 'Press SPACE to continue...';
  chatInput.readOnly = true;
  advanceTurn();
}

async function advanceTurn() {
  currentTurn++;
  if (currentTurn >= SCRIPT.length) {
    chatInput.placeholder = 'Demo complete \u2014 refresh to restart';
    return;
  }

  isAnimating = true;
  const turn = SCRIPT[currentTurn];

  // Typewriter effect for user message
  await typeUserMessage(turn.user);

  // Brief pause then show agent thinking
  await delay(600);
  const typingEl = showTyping();

  // Simulate thinking time
  await delay(1200);
  typingEl.remove();

  // Show agent response
  appendAssistantMessage(turn.agent, turn.card);

  isAnimating = false;
  scrollToBottom();

  if (currentTurn < SCRIPT.length - 1) {
    chatInput.placeholder = 'Press SPACE for next message...';
  } else {
    chatInput.placeholder = 'Demo complete \u2014 refresh to restart';
  }
}

async function typeUserMessage(text) {
  const msg = document.createElement('div');
  msg.className = 'msg msg-user';
  const bubble = document.createElement('div');
  bubble.className = 'msg-bubble';
  bubble.textContent = '';
  msg.appendChild(bubble);
  chatMessages.appendChild(msg);
  scrollToBottom();

  // Typewriter effect
  for (let i = 0; i < text.length; i++) {
    bubble.textContent += text[i];
    scrollToBottom();
    await delay(25 + Math.random() * 20);
  }

  await delay(200);
}

function appendAssistantMessage(content, card) {
  const msg = document.createElement('div');
  msg.className = 'msg msg-assistant';

  const textEl = document.createElement('div');
  textEl.className = 'msg-text';
  renderText(textEl, content);
  msg.appendChild(textEl);

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

  [
    { label: 'Current Plan', value: data.plan, large: false },
    { label: 'Monthly Rate', value: data.monthlyRate, large: true },
    { label: 'Next Billing', value: data.nextBilling, large: false },
    { label: 'Payment Method', value: data.paymentMethod, large: false },
  ].forEach(item => {
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
  title.textContent = 'API Usage \u2014 Last 7 Days';
  const badge = document.createElement('span');
  badge.className = 'card-badge badge-warning';
  badge.textContent = data.rateLimitUsed + '% of limit';
  header.appendChild(title);
  header.appendChild(badge);

  const body = document.createElement('div');
  body.className = 'card-body';

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

  const savings = document.createElement('div');
  savings.className = 'plan-savings';
  savings.textContent = data.savings;
  body.appendChild(savings);

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

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
