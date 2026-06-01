/**
 * Concierge 2.0 — 4 conversation paths based on category button pressed.
 *
 * Flow:
 * 1. User clicks a category button → conversation path loads
 * 2. Press SPACE → text types into the input bar
 * 3. Press ENTER → message sends up to chat area
 * 4. Anthropic logo pulses (thinking)
 * 5. Agent response + card renders
 * 6. Wait for next SPACE press
 */

const welcomeSection = document.getElementById('welcomeSection');
const chatSection = document.getElementById('chatSection');
const chatMessages = document.getElementById('chatMessages');
const chatInput = document.getElementById('chatInput');
const chatSendBtn = document.getElementById('chatSendBtn');
const searchInput = document.getElementById('searchInput');
const searchSubmit = document.getElementById('searchSubmit');
const inputHint = document.getElementById('inputHint');

// ============================================================
// 4 CONVERSATION PATHS — one per category button
// ============================================================

const SCRIPTS = {
  billing: [
    {
      user: "Can you show me my current billing and plan details?",
      agent: "Of course! Here's your current billing summary. You're on the **Team plan** at $599/month with your next billing cycle on June 15th. You've used about 81% of your included allocation so far this period.",
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
      user: "That usage is higher than I expected. Can I set up an alert so I know before I hit my limit?",
      agent: "Smart move! You can configure a spend alert threshold below. When your usage crosses that amount in a billing period, we'll notify you via email and Slack webhook.",
      card: {
        type: 'spend_alert',
        data: {
          currentSpend: 487.32,
          budget: 599,
          suggestedThreshold: 500
        }
      }
    },
    {
      user: "Is there a way to get more capacity without overage charges?",
      agent: "Based on your usage trajectory, I'd recommend upgrading to the **Scale plan**. You'd get 5x the token allowance and eliminate overage risk entirely. Here's a side-by-side comparison:",
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
          savings: 'At your current trajectory, you\'ll hit overage fees of ~$200/mo. Scale eliminates that and gives you room to grow.'
        }
      }
    }
  ],

  usage: [
    {
      user: "I've been hitting rate limits in production. Can you show me my API usage?",
      agent: "I can see you're hitting **87% of your rate limit** during peak hours, especially around 2 PM UTC. Your average daily request volume has been climbing steadily this week. Here's the full breakdown:",
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
      user: "Can I test what my latency looks like right now with my current plan?",
      agent: "Absolutely! Here's a quick model playground. Hit **Run Test** to send a sample prompt and see your current latency and token throughput in real time.",
      card: {
        type: 'model_playground',
        data: {
          model: 'claude-sonnet-4-6',
          samplePrompt: 'Explain the difference between REST and GraphQL in one sentence.',
          estimatedTokens: 42
        }
      }
    },
    {
      user: "That latency is higher than I'd like. What can I do to get faster responses?",
      agent: "The latency you're seeing is directly related to hitting your rate limit ceiling. When requests queue up, response times increase. Upgrading to **Scale** gives you 5x throughput and significantly lower p95 latency during peak hours:",
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
      user: "Let's do it. Upgrade me to Scale.",
      agent: "Done! Your upgrade to the **Scale plan** has been processed and the new limits are active immediately. You should see the rate-limit pressure drop right away. Welcome to Scale!",
      card: {
        type: 'upgrade_confirmation',
        data: {
          plan: 'Scale',
          effectiveDate: 'Immediately',
          newRateLimit: '5,000 RPM',
          newTokens: '25M tokens/mo',
          nextBilling: 'June 15, 2026 — $1,499'
        }
      }
    }
  ],

  access: [
    {
      user: "I need to rotate my production API key. There may have been a leak.",
      agent: "I'll help you with that right away. Here's your current key — click **Generate New Key** to create a new one and automatically revoke the old one. Make sure to copy the new key before navigating away.",
      card: {
        type: 'api_key_rotation',
        data: {
          currentKey: 'sk-ant-api03-****************************7f2x',
          keyName: 'Production — main app',
          created: 'Mar 12, 2026',
          lastUsed: '2 minutes ago'
        }
      }
    },
    {
      user: "Done. Can you show me my recent API usage to make sure nothing unusual happened?",
      agent: "Here's your usage for the last 7 days. I don't see any anomalous spikes that would suggest unauthorized usage, but the key rotation was a good precaution.",
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
      user: "Good, looks normal. Can I set up a spend alert as an extra safety net?",
      agent: "Absolutely. Configure your threshold below — if usage spikes unexpectedly you'll get notified immediately before any significant charges accrue.",
      card: {
        type: 'spend_alert',
        data: {
          currentSpend: 487.32,
          budget: 599,
          suggestedThreshold: 500
        }
      }
    }
  ],

  plans: [
    {
      user: "What plans are available and how do they compare to what I have now?",
      agent: "You're currently on the **Team plan**. Here's how it compares to our **Scale** tier, which is the next step up. Scale is designed for production workloads that need higher throughput and priority support:",
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
          savings: 'Scale includes access to Opus for complex reasoning tasks, 5x rate limits, and dedicated support with <1hr response SLA.'
        }
      }
    },
    {
      user: "What does my current usage look like? Would Scale actually benefit me?",
      agent: "Let me pull your numbers. You're at **87% of your rate limit** during peak hours and climbing week over week — so yes, you'd see an immediate improvement:",
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
      user: "OK, I'm convinced. Let's upgrade to Scale.",
      agent: "Done! Your upgrade to the **Scale plan** has been processed and the new limits are active immediately. Your team now has access to Opus and 5,000 RPM. Welcome to Scale!",
      card: {
        type: 'upgrade_confirmation',
        data: {
          plan: 'Scale',
          effectiveDate: 'Immediately',
          newRateLimit: '5,000 RPM',
          newTokens: '25M tokens/mo',
          nextBilling: 'June 15, 2026 — $1,499'
        }
      }
    },
    {
      user: "Can I quickly test the new throughput to confirm it's working?",
      agent: "Of course! Hit **Run Test** below to fire a request on your new Scale plan and see the improved latency.",
      card: {
        type: 'model_playground',
        data: {
          model: 'claude-sonnet-4-6',
          samplePrompt: 'Summarize the key benefits of moving from monolith to microservices.',
          estimatedTokens: 56
        }
      }
    }
  ]
};

let activeScript = [];
let currentTurn = -1;
let state = 'IDLE'; // IDLE, TYPING, READY_TO_SEND, RESPONDING
let typeInterval = null;
let conversationStarted = false;

// Category buttons start conversation with specific path
document.querySelectorAll('.category-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const path = btn.dataset.path;
    startConversation(path);
  });
});

searchSubmit.addEventListener('click', () => startConversation('billing'));
searchInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') startConversation('billing');
});

// Main keyboard handler
document.addEventListener('keydown', (e) => {
  if (!conversationStarted) return;

  if (e.code === 'Space' && state === 'IDLE') {
    e.preventDefault();
    advanceToNextTurn();
  } else if (e.key === 'Enter' && state === 'READY_TO_SEND') {
    e.preventDefault();
    sendCurrentMessage();
  }
});

function startConversation(path) {
  activeScript = SCRIPTS[path] || SCRIPTS.billing;
  currentTurn = -1;
  welcomeSection.classList.add('hidden');
  chatSection.classList.add('visible');
  conversationStarted = true;
  chatMessages.textContent = '';
  inputHint.textContent = 'Press SPACE to start the conversation';
  advanceToNextTurn();
}

function advanceToNextTurn() {
  currentTurn++;
  if (currentTurn >= activeScript.length) {
    chatInput.value = '';
    chatInput.placeholder = 'Demo complete — refresh to restart';
    inputHint.textContent = '';
    state = 'DONE';
    return;
  }

  state = 'TYPING';
  inputHint.textContent = '';
  chatInput.placeholder = '';

  const text = activeScript[currentTurn].user;
  let charIndex = 0;

  chatInput.value = '';
  typeInterval = setInterval(() => {
    chatInput.value += text[charIndex];
    charIndex++;
    if (charIndex >= text.length) {
      clearInterval(typeInterval);
      state = 'READY_TO_SEND';
      inputHint.textContent = 'Press ENTER to send';
      chatSendBtn.disabled = false;
    }
  }, 30);
}

async function sendCurrentMessage() {
  const message = chatInput.value;
  chatInput.value = '';
  chatSendBtn.disabled = true;
  state = 'RESPONDING';
  inputHint.textContent = '';

  appendUserMessage(message);

  const thinkingEl = showThinking();
  await delay(1500);
  thinkingEl.remove();

  const turn = activeScript[currentTurn];
  appendAssistantMessage(turn.agent, turn.card);
  scrollToBottom();

  state = 'IDLE';
  if (currentTurn < activeScript.length - 1) {
    inputHint.textContent = 'Press SPACE for next message';
    chatInput.placeholder = '';
  } else {
    chatInput.placeholder = 'Demo complete — refresh to restart';
    inputHint.textContent = '';
  }
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

function showThinking() {
  const el = document.createElement('div');
  el.className = 'msg msg-assistant';
  const thinking = document.createElement('div');
  thinking.className = 'thinking-logo';
  const img = document.createElement('img');
  img.src = 'https://cdn.jsdelivr.net/gh/homarr-labs/dashboard-icons/png/anthropic.png';
  img.alt = 'Thinking';
  const label = document.createElement('span');
  label.textContent = 'Thinking...';
  thinking.appendChild(img);
  thinking.appendChild(label);
  el.appendChild(thinking);
  chatMessages.appendChild(el);
  scrollToBottom();
  return el;
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
    case 'api_key_rotation': return renderAPIKeyCard(card.data);
    case 'spend_alert': return renderSpendAlertCard(card.data);
    case 'model_playground': return renderPlaygroundCard(card.data);
    default: return null;
  }
}

// === Card Renderers ===

function renderBillingCard(data) {
  const card = document.createElement('div');
  card.className = 'card';
  const header = createCardHeader('Billing Summary', 'Active', 'badge-active');
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
  body.appendChild(createProgressBar(data.usagePercent, data.usagePercent > 80));
  card.appendChild(header);
  card.appendChild(body);
  return card;
}

function renderUsageCard(data) {
  const card = document.createElement('div');
  card.className = 'card';
  const header = createCardHeader('API Usage — Last 7 Days', data.rateLimitUsed + '% of limit', 'badge-warning');
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
  body.appendChild(createProgressBar(data.rateLimitUsed, true));
  card.appendChild(header);
  card.appendChild(body);
  return card;
}

function renderPlanCard(data) {
  const card = document.createElement('div');
  card.className = 'card';
  const header = createCardHeader('Plan Comparison', 'Upgrade Available', 'badge-info');
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
    [plan.rateLimit + ' rate limit', plan.tokens + ' included', plan.support + ' support', plan.models + ' models'].forEach(f => {
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
  const header = createCardHeader('Upgrade Confirmed', 'Complete', 'badge-success');
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

function renderAPIKeyCard(data) {
  const card = document.createElement('div');
  card.className = 'card';
  const header = createCardHeader('API Key Management', 'Active', 'badge-active');
  const body = document.createElement('div');
  body.className = 'card-body';
  const keyLabel = document.createElement('div');
  keyLabel.className = 'billing-label';
  keyLabel.textContent = data.keyName;
  const keyValue = document.createElement('div');
  keyValue.className = 'key-value';
  keyValue.textContent = data.currentKey;
  const keyMeta = document.createElement('div');
  keyMeta.className = 'key-meta';
  keyMeta.textContent = 'Created ' + data.created + ' \u00B7 Last used ' + data.lastUsed;
  body.appendChild(keyLabel);
  body.appendChild(keyValue);
  body.appendChild(keyMeta);
  const badge = header.querySelector('.card-badge');
  const btn = document.createElement('button');
  btn.className = 'upgrade-btn';
  btn.textContent = 'Generate New Key';
  btn.addEventListener('click', () => {
    btn.disabled = true;
    btn.textContent = 'Generating...';
    setTimeout(() => {
      const newKey = 'sk-ant-api03-' + generateRandomKey(48);
      keyValue.textContent = newKey;
      keyValue.classList.add('key-new');
      keyMeta.textContent = 'Created just now \u00B7 Never used';
      badge.textContent = 'Rotated';
      badge.className = 'card-badge badge-success';
      btn.textContent = 'Copy New Key';
      btn.disabled = false;
      btn.addEventListener('click', () => {
        navigator.clipboard.writeText(newKey).catch(() => {});
        btn.textContent = 'Copied!';
        btn.disabled = true;
      }, { once: true });
      const warning = document.createElement('div');
      warning.className = 'key-warning';
      warning.textContent = '\u26A0\uFE0F Your old key has been revoked. Update your environment variables.';
      body.appendChild(warning);
    }, 1200);
  });
  body.appendChild(btn);
  card.appendChild(header);
  card.appendChild(body);
  return card;
}

function renderSpendAlertCard(data) {
  const card = document.createElement('div');
  card.className = 'card';
  const header = createCardHeader('Spend Alert Configuration', 'Configure', 'badge-info');
  const badge = header.querySelector('.card-badge');
  const body = document.createElement('div');
  body.className = 'card-body';
  const spendRow = document.createElement('div');
  spendRow.className = 'spend-row';
  const spendLabel = document.createElement('span');
  spendLabel.className = 'billing-label';
  spendLabel.textContent = 'Current period spend';
  const spendValue = document.createElement('span');
  spendValue.className = 'billing-value';
  spendValue.textContent = '$' + data.currentSpend.toFixed(2) + ' / $' + data.budget;
  spendRow.appendChild(spendLabel);
  spendRow.appendChild(spendValue);
  body.appendChild(spendRow);
  const sliderGroup = document.createElement('div');
  sliderGroup.className = 'slider-group';
  const sliderLabel = document.createElement('div');
  sliderLabel.className = 'slider-label';
  sliderLabel.textContent = 'Alert threshold: $' + data.suggestedThreshold;
  const slider = document.createElement('input');
  slider.type = 'range';
  slider.min = '100';
  slider.max = String(data.budget);
  slider.value = String(data.suggestedThreshold);
  slider.className = 'threshold-slider';
  slider.addEventListener('input', () => {
    sliderLabel.textContent = 'Alert threshold: $' + slider.value;
  });
  sliderGroup.appendChild(sliderLabel);
  sliderGroup.appendChild(slider);
  body.appendChild(sliderGroup);
  const channels = document.createElement('div');
  channels.className = 'alert-channels';
  const channelsLabel = document.createElement('div');
  channelsLabel.className = 'billing-label';
  channelsLabel.textContent = 'Notify via:';
  channels.appendChild(channelsLabel);
  const channelOpts = document.createElement('div');
  channelOpts.className = 'channel-options';
  ['Email', 'Slack Webhook', 'SMS'].forEach(ch => {
    const label = document.createElement('label');
    label.className = 'channel-toggle';
    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.checked = ch !== 'SMS';
    const span = document.createElement('span');
    span.textContent = ch;
    label.appendChild(cb);
    label.appendChild(span);
    channelOpts.appendChild(label);
  });
  channels.appendChild(channelOpts);
  body.appendChild(channels);
  const btn = document.createElement('button');
  btn.className = 'upgrade-btn';
  btn.textContent = 'Save Alert';
  btn.addEventListener('click', () => {
    btn.disabled = true;
    btn.textContent = 'Saving...';
    setTimeout(() => {
      btn.textContent = '\u2713 Alert Configured';
      badge.textContent = 'Active';
      badge.className = 'card-badge badge-success';
    }, 800);
  });
  body.appendChild(btn);
  card.appendChild(header);
  card.appendChild(body);
  return card;
}

function renderPlaygroundCard(data) {
  const card = document.createElement('div');
  card.className = 'card';
  const header = createCardHeader('Model Playground', data.model, 'badge-active');
  const badge = header.querySelector('.card-badge');
  const body = document.createElement('div');
  body.className = 'card-body';
  const promptGroup = document.createElement('div');
  promptGroup.className = 'playground-prompt';
  const promptLabel = document.createElement('div');
  promptLabel.className = 'billing-label';
  promptLabel.textContent = 'Test Prompt';
  const promptText = document.createElement('div');
  promptText.className = 'prompt-text';
  promptText.textContent = data.samplePrompt;
  promptGroup.appendChild(promptLabel);
  promptGroup.appendChild(promptText);
  body.appendChild(promptGroup);
  const results = document.createElement('div');
  results.className = 'playground-results';
  results.style.display = 'none';
  body.appendChild(results);
  const btn = document.createElement('button');
  btn.className = 'upgrade-btn';
  btn.textContent = 'Run Test';
  btn.addEventListener('click', () => {
    btn.disabled = true;
    btn.textContent = 'Running...';
    setTimeout(() => {
      const latency = (180 + Math.random() * 120).toFixed(0);
      const tokens = 38 + Math.floor(Math.random() * 15);
      const tokensPerSec = (tokens / (parseInt(latency) / 1000)).toFixed(1);
      results.style.display = 'block';
      const responseLabel = document.createElement('div');
      responseLabel.className = 'billing-label';
      responseLabel.textContent = 'Response';
      const responseText = document.createElement('div');
      responseText.className = 'playground-response';
      responseText.textContent = 'REST is a resource-based architectural style using standard HTTP methods, while GraphQL is a query language that lets clients request exactly the data they need in a single endpoint.';
      const statsRow = document.createElement('div');
      statsRow.className = 'playground-stats';
      [
        { label: 'Latency', value: latency + 'ms' },
        { label: 'Output Tokens', value: String(tokens) },
        { label: 'Throughput', value: tokensPerSec + ' tok/s' }
      ].forEach(s => {
        const stat = document.createElement('div');
        stat.className = 'playground-stat';
        const val = document.createElement('div');
        val.className = 'usage-stat-value';
        val.textContent = s.value;
        const lbl = document.createElement('div');
        lbl.className = 'usage-stat-label';
        lbl.textContent = s.label;
        stat.appendChild(val);
        stat.appendChild(lbl);
        statsRow.appendChild(stat);
      });
      results.appendChild(responseLabel);
      results.appendChild(responseText);
      results.appendChild(statsRow);
      btn.textContent = '\u2713 Complete';
      badge.textContent = latency + 'ms';
      badge.className = 'card-badge badge-success';
      scrollToBottom();
    }, 800 + Math.random() * 600);
  });
  body.appendChild(btn);
  card.appendChild(header);
  card.appendChild(body);
  return card;
}

// === Helpers ===

function createCardHeader(titleText, badgeText, badgeClass) {
  const header = document.createElement('div');
  header.className = 'card-header';
  const title = document.createElement('span');
  title.className = 'card-title';
  title.textContent = titleText;
  const badge = document.createElement('span');
  badge.className = 'card-badge ' + badgeClass;
  badge.textContent = badgeText;
  header.appendChild(title);
  header.appendChild(badge);
  return header;
}

function createProgressBar(percent, isWarning) {
  const progress = document.createElement('div');
  progress.className = 'progress-bar';
  const fill = document.createElement('div');
  fill.className = 'progress-fill ' + (isWarning ? 'warning' : 'ok');
  fill.style.width = percent + '%';
  progress.appendChild(fill);
  return progress;
}

function generateRandomKey(length) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

function scrollToBottom() {
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
