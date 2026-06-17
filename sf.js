const fetch = require('node-fetch');

let accessToken = null;
let tokenExpiry = 0;

async function getAccessToken() {
  // Return cached token if still valid
  if (accessToken && Date.now() < tokenExpiry) {
    return accessToken;
  }

  const params = new URLSearchParams({
    grant_type: 'refresh_token',
    client_id: process.env.SF_CLIENT_ID,
    client_secret: process.env.SF_CLIENT_SECRET,
    refresh_token: process.env.SF_REFRESH_TOKEN
  });

  const response = await fetch(`${process.env.SF_LOGIN_URL}/services/oauth2/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString()
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`OAuth token refresh failed: ${error}`);
  }

  const data = await response.json();
  accessToken = data.access_token;
  // Cache for 1 hour (tokens typically last 2 hours)
  tokenExpiry = Date.now() + 3600000;

  return accessToken;
}

async function sfRequest(method, endpoint, body) {
  const token = await getAccessToken();
  const instanceUrl = process.env.SF_INSTANCE_URL;

  const options = {
    method,
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  };

  if (body) {
    options.body = JSON.stringify(body);
  }

  const response = await fetch(`${instanceUrl}/services/data/v60.0/${endpoint}`, options);

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Salesforce API error (${response.status}): ${error}`);
  }

  // Handle 204 No Content
  if (response.status === 204) return {};

  return response.json();
}

async function createCase(caseData) {
  const result = await sfRequest('POST', 'sobjects/Case', caseData);

  // Query back the case number
  let caseNumber = null;
  try {
    const query = await sfRequest(
      'GET',
      `query?q=SELECT+CaseNumber+FROM+Case+WHERE+Id='${result.id}'`
    );
    if (query.records && query.records.length > 0) {
      caseNumber = query.records[0].CaseNumber;
    }
  } catch (e) {
    // Non-critical — we still have the Id
  }

  return { id: result.id, caseNumber };
}

async function createTask(taskData) {
  const result = await sfRequest('POST', 'sobjects/Task', taskData);
  return { id: result.id };
}

async function queryContact(email) {
  const result = await sfRequest(
    'GET',
    `query?q=SELECT+Id,FirstName,LastName,Email+FROM+Contact+WHERE+Email='${email}'+LIMIT+1`
  );
  return result.records && result.records.length > 0 ? result.records[0] : null;
}

async function updateContact(contactId, data) {
  await sfRequest('PATCH', `sobjects/Contact/${contactId}`, data);
  return { success: true };
}

function getMessagingHost() {
  const rawUrl = process.env.SF_MESSAGING_URL || '';
  return rawUrl
    .replace(/^https?:\/\//, '')
    .replace(/\/+$/, '');
}

async function initializeMessagingSession() {
  const host = getMessagingHost();
  const orgId = process.env.SF_MESSAGING_ORG_ID;
  const developerName = process.env.SF_MESSAGING_DEPLOYMENT_NAME;

  if (!host || !orgId || !developerName) {
    throw new Error('Missing messaging config. Set SF_MESSAGING_URL, SF_MESSAGING_ORG_ID, SF_MESSAGING_DEPLOYMENT_NAME.');
  }

  const tokenResponse = await fetch(`https://${host}/iamessage/api/v2/authorization/unauthenticated/access-token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      orgId,
      esDeveloperName: developerName,
      capabilitiesVersion: '1',
      platform: 'Web',
      context: {
        appName: 'AnthropicPrototype',
        clientVersion: '1.0.0'
      }
    })
  });

  if (!tokenResponse.ok) {
    const tokenError = await tokenResponse.text();
    throw new Error(`Messaging token request failed (${tokenResponse.status}): ${tokenError}`);
  }

  const tokenData = await tokenResponse.json();
  const accessToken = tokenData.accessToken;
  const conversationId = `${Date.now()}-${Math.random().toString(16).slice(2)}`.toLowerCase();

  const conversationResponse = await fetch(`https://${host}/iamessage/api/v2/conversation`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      conversationId,
      esDeveloperName: developerName
    })
  });

  if (!conversationResponse.ok) {
    const conversationError = await conversationResponse.text();
    throw new Error(`Messaging conversation start failed (${conversationResponse.status}): ${conversationError}`);
  }

  return {
    accessToken,
    conversationId,
    lastEventId: tokenData.lastEventId || null
  };
}

async function sendMessagingMessage({ accessToken, conversationId, text }) {
  const host = getMessagingHost();
  const developerName = process.env.SF_MESSAGING_DEPLOYMENT_NAME;

  if (!accessToken || !conversationId || !text) {
    throw new Error('Missing message payload.');
  }

  const response = await fetch(`https://${host}/iamessage/api/v2/conversation/${conversationId}/message`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      message: {
        id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
        messageType: 'StaticContentMessage',
        staticContent: {
          formatType: 'Text',
          text
        }
      },
      esDeveloperName: developerName,
      isNewMessagingSession: false,
      language: ''
    })
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Messaging send failed (${response.status}): ${error}`);
  }
}

async function getMessagingMessages({ accessToken, conversationId }) {
  const host = getMessagingHost();

  if (!accessToken || !conversationId) {
    throw new Error('Missing message query payload.');
  }

  const response = await fetch(
    `https://${host}/iamessage/api/v2/conversation/${conversationId}/entries?limit=50&direction=FromEnd`,
    {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    }
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Messaging fetch failed (${response.status}): ${error}`);
  }

  const data = await response.json();
  const conversationEntries = Array.isArray(data.conversationEntries) ? data.conversationEntries : [];

  const parsed = conversationEntries
    .filter(entry => entry.entryType === 'Message')
    .map(entry => {
      const payload = entry.entryPayload && entry.entryPayload.abstractMessage;
      const text = payload && payload.staticContent ? payload.staticContent.text : null;
      return {
        id: payload && payload.id ? payload.id : `${entry.serverTimestamp || Date.now()}`,
        senderRole: (entry.sender && entry.sender.role) || 'system',
        text,
        timestamp: entry.serverTimestamp || entry.clientTimestamp || 0
      };
    })
    .filter(entry => !!entry.text)
    .sort((a, b) => a.timestamp - b.timestamp);

  return parsed;
}

module.exports = {
  createCase,
  createTask,
  queryContact,
  updateContact,
  initializeMessagingSession,
  sendMessagingMessage,
  getMessagingMessages
};
