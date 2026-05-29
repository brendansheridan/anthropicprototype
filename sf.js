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

module.exports = {
  createCase,
  createTask,
  queryContact,
  updateContact
};
