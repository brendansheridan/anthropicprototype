/**
 * Scripted conversation engine for the Claude-to-Salesforce demo.
 * Uses keyword matching to simulate AI responses while triggering real SF actions.
 */

const STATES = {
  GREETING: 'greeting',
  LISTENING: 'listening',
  CASE_CREATED: 'case_created',
  FOLLOW_UP: 'follow_up',
  CLOSED: 'closed'
};

function getResponse(message, history) {
  const msg = message.toLowerCase().trim();
  const state = determineState(history);

  // State: Initial greeting
  if (state === STATES.GREETING) {
    if (isGreeting(msg)) {
      return {
        response: "Hello! I'm Claude, your AI customer service assistant. I'm connected directly to our support systems, so I can help create cases, track issues, and get you the help you need. What can I assist you with today?",
        action: null,
        newState: STATES.LISTENING
      };
    }
    // If they jump straight to an issue
    return handleIssue(msg);
  }

  // State: Listening for an issue
  if (state === STATES.LISTENING) {
    return handleIssue(msg);
  }

  // State: Case was created, waiting for follow-up
  if (state === STATES.CASE_CREATED) {
    if (isFollowUp(msg)) {
      return handleFollowUp(msg);
    }
    if (isClosing(msg)) {
      return {
        response: "You're welcome! Your case is being tracked and our team will follow up. Don't hesitate to reach out if you need anything else. Have a great day!",
        action: null,
        newState: STATES.CLOSED
      };
    }
    return handleFollowUp(msg);
  }

  // State: Follow-up task created
  if (state === STATES.FOLLOW_UP) {
    if (isClosing(msg)) {
      return {
        response: "Happy to help! Everything is logged in our system — your case and follow-up task are both being tracked. Our team will be in touch. Take care!",
        action: null,
        newState: STATES.CLOSED
      };
    }
    return {
      response: "Is there anything else I can help you with? I can create additional cases or schedule follow-ups as needed.",
      action: null,
      newState: STATES.FOLLOW_UP
    };
  }

  // State: Closed - restart if they continue
  if (state === STATES.CLOSED) {
    return {
      response: "Welcome back! How can I help you today?",
      action: null,
      newState: STATES.LISTENING
    };
  }

  // Default fallback
  return {
    response: "I'm here to help with any customer service needs. You can describe an issue and I'll create a support case, or ask me to schedule a follow-up. What would you like to do?",
    action: null,
    newState: STATES.LISTENING
  };
}

function handleIssue(msg) {
  const subject = extractSubject(msg);
  const description = msg.charAt(0).toUpperCase() + msg.slice(1);

  return {
    response: `I understand you're experiencing an issue with ${subject.toLowerCase()}. Let me create a support case for you right now.\n\n✓ **Case created** — Reference number: **{{CASE_NUMBER}}**\n\nOur support team will review this and get back to you within 24 hours. Is there anything else I can help with, or would you like me to schedule a follow-up call?`,
    action: 'create_case',
    caseData: {
      subject: subject,
      description: `Customer reported via AI Chat:\n\n${description}`
    },
    newState: STATES.CASE_CREATED
  };
}

function handleFollowUp(msg) {
  const taskSubject = extractTaskSubject(msg);

  return {
    response: `Absolutely, I've scheduled a follow-up for you.\n\n✓ **Task created** — "${taskSubject}"\n\nA team member will reach out to follow up on your case. Is there anything else I can help with?`,
    action: 'create_task',
    taskData: {
      subject: taskSubject,
      description: `Follow-up requested by customer via AI Chat. Original message: ${msg}`
    },
    newState: STATES.FOLLOW_UP
  };
}

function determineState(history) {
  if (!history || history.length === 0) return STATES.GREETING;

  // Look at the last conversation state
  const lastAssistant = [...history].reverse().find(h => h.role === 'assistant');
  if (!lastAssistant) return STATES.GREETING;

  if (lastAssistant.state) return lastAssistant.state;

  // Infer from content
  const content = lastAssistant.content || '';
  if (content.includes('Case created')) return STATES.CASE_CREATED;
  if (content.includes('Task created')) return STATES.FOLLOW_UP;
  if (content.includes('What can I assist')) return STATES.LISTENING;

  return STATES.LISTENING;
}

function isGreeting(msg) {
  const greetings = ['hello', 'hi', 'hey', 'good morning', 'good afternoon', 'good evening', 'howdy', 'greetings'];
  return greetings.some(g => msg.startsWith(g) || msg === g);
}

function isClosing(msg) {
  const closings = ['thank', 'thanks', 'no', 'nope', 'that\'s all', 'that\'s it', 'nothing else', 'goodbye', 'bye', 'all good', 'all set'];
  return closings.some(c => msg.includes(c));
}

function isFollowUp(msg) {
  const followUps = ['follow up', 'follow-up', 'callback', 'call back', 'call me', 'schedule', 'check in', 'check-in', 'reminder', 'yes', 'please', 'sure'];
  return followUps.some(f => msg.includes(f));
}

function extractSubject(msg) {
  // Try to extract a meaningful subject from the message
  const patterns = [
    { regex: /issue with (.+?)(?:\.|$)/i, group: 1 },
    { regex: /problem with (.+?)(?:\.|$)/i, group: 1 },
    { regex: /can't (.+?)(?:\.|$)/i, group: 1 },
    { regex: /unable to (.+?)(?:\.|$)/i, group: 1 },
    { regex: /not working(.+?)(?:\.|$)/i, group: 0 },
    { regex: /broken (.+?)(?:\.|$)/i, group: 1 },
    { regex: /error (.+?)(?:\.|$)/i, group: 0 },
    { regex: /help with (.+?)(?:\.|$)/i, group: 1 }
  ];

  for (const pattern of patterns) {
    const match = msg.match(pattern.regex);
    if (match && match[pattern.group]) {
      const subject = match[pattern.group].trim();
      return subject.charAt(0).toUpperCase() + subject.slice(1);
    }
  }

  // Fallback: use first 60 chars of message as subject
  const truncated = msg.length > 60 ? msg.substring(0, 57) + '...' : msg;
  return truncated.charAt(0).toUpperCase() + truncated.slice(1);
}

function extractTaskSubject(msg) {
  if (msg.includes('call')) return 'Follow-up call with customer';
  if (msg.includes('email')) return 'Send follow-up email to customer';
  if (msg.includes('check')) return 'Check in with customer on case status';
  return 'Follow up with customer regarding support case';
}

module.exports = { getResponse };
