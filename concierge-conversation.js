/**
 * Concierge 2.0 conversation engine for Anthropic developer portal.
 * Scripted flow: billing, API usage, plan upgrade upsell.
 */

const STATES = {
  WELCOME: 'welcome',
  BILLING: 'billing',
  USAGE: 'usage',
  UPSELL: 'upsell',
  CONFIRMED: 'confirmed'
};

function getConciergeResponse(message, history) {
  const msg = message.toLowerCase().trim();
  const state = determineState(history);

  // WELCOME → first interaction
  if (state === STATES.WELCOME) {
    if (isBilling(msg)) return billingResponse();
    if (isUsage(msg) || isAPI(msg)) return usageResponse();
    if (isUpgrade(msg)) return upsellResponse();
    // Default: treat as billing inquiry
    return billingResponse();
  }

  // BILLING → next step is usage or upgrade
  if (state === STATES.BILLING) {
    if (isUsage(msg) || isAPI(msg)) return usageResponse();
    if (isUpgrade(msg)) return upsellResponse();
    return usageResponse(); // default progression
  }

  // USAGE → next step is upsell
  if (state === STATES.USAGE) {
    if (isUpgrade(msg) || isYes(msg)) return upsellResponse();
    if (isBilling(msg)) return billingResponse();
    return upsellResponse(); // default progression
  }

  // UPSELL → confirm
  if (state === STATES.UPSELL) {
    if (isYes(msg) || isUpgrade(msg) || msg.includes('upgrade') || msg.includes('yes') || msg.includes('go ahead')) {
      return confirmResponse();
    }
    return {
      response: "No problem! Let me know if you change your mind or have any other questions about your account.",
      card: null,
      newState: STATES.UPSELL
    };
  }

  // CONFIRMED → wrap up
  if (state === STATES.CONFIRMED) {
    return {
      response: "Is there anything else I can help you with today? I can assist with billing, API configuration, usage monitoring, or account settings.",
      card: null,
      newState: STATES.WELCOME
    };
  }

  return billingResponse();
}

function billingResponse() {
  return {
    response: "Here's your current billing summary. You're on the **Team plan** with your next billing cycle coming up on June 15th.",
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
    },
    newState: STATES.BILLING
  };
}

function usageResponse() {
  return {
    response: "Here's your API usage for the current billing period. You're at **87% of your rate limit** during peak hours — let me know if you'd like to explore options for higher throughput.",
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
    },
    newState: STATES.USAGE
  };
}

function upsellResponse() {
  return {
    response: "Based on your usage patterns, you'd benefit from our **Scale plan**. You're regularly hitting rate limits during peak hours, and Scale would give you 5x the throughput plus priority support.",
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
        savings: 'Based on your usage, Scale would eliminate all rate-limit delays and save ~4.2 engineering hours/week.'
      }
    },
    newState: STATES.UPSELL
  };
}

function confirmResponse() {
  return {
    response: "Your upgrade to the **Scale plan** has been processed. The new rate limits and features are active immediately.",
    card: {
      type: 'upgrade_confirmation',
      data: {
        plan: 'Scale',
        effectiveDate: 'Immediately',
        newRateLimit: '5,000 RPM',
        newTokens: '25M tokens/mo',
        nextBilling: 'June 15, 2026 — $1,499'
      }
    },
    newState: STATES.CONFIRMED
  };
}

function determineState(history) {
  if (!history || history.length === 0) return STATES.WELCOME;
  const last = [...history].reverse().find(h => h.role === 'assistant');
  if (!last) return STATES.WELCOME;
  if (last.state) return last.state;
  return STATES.WELCOME;
}

function isBilling(msg) {
  return ['billing', 'bill', 'payment', 'invoice', 'charge', 'cost', 'subscription', 'plan'].some(k => msg.includes(k));
}

function isUsage(msg) {
  return ['usage', 'requests', 'tokens', 'rate limit', 'throughput', 'latency', 'api usage'].some(k => msg.includes(k));
}

function isAPI(msg) {
  return ['api', 'access', 'keys', 'endpoint', 'integration'].some(k => msg.includes(k));
}

function isUpgrade(msg) {
  return ['upgrade', 'scale', 'higher', 'more', 'increase', 'limit', 'pricing', 'plans'].some(k => msg.includes(k));
}

function isYes(msg) {
  return ['yes', 'sure', 'go ahead', 'do it', 'let\'s do', 'upgrade', 'confirm', 'proceed'].some(k => msg.includes(k));
}

module.exports = { getConciergeResponse };
