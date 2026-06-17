const fetch = require('node-fetch');
const { randomUUID } = require('crypto');

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

async function queryRecords(soql) {
  const result = await sfRequest('GET', `query?q=${encodeURIComponent(soql)}`);
  return Array.isArray(result.records) ? result.records : [];
}

async function updateContact(contactId, data) {
  await sfRequest('PATCH', `sobjects/Contact/${contactId}`, data);
  return { success: true };
}

async function getCaseByReference(caseRef) {
  const ref = String(caseRef || '').trim();
  if (!ref) {
    throw new Error('Case reference is required.');
  }

  const isCaseId = /^500[a-zA-Z0-9]{12,15}$/.test(ref);
  const where = isCaseId
    ? `Id='${ref}'`
    : `CaseNumber='${ref.replace(/'/g, "\\'")}'`;

  const soql = [
    'SELECT Id,CaseNumber,Subject,Status,Priority,Origin,Type,Description,CreatedDate',
    `FROM Case WHERE ${where} LIMIT 1`
  ].join(' ');

  const records = await queryRecords(soql);
  if (records.length === 0) {
    throw new Error('Case not found.');
  }
  const row = records[0];
  return {
    id: row.Id,
    caseNumber: row.CaseNumber,
    subject: row.Subject,
    status: row.Status,
    priority: row.Priority,
    origin: row.Origin,
    type: row.Type,
    description: row.Description,
    createdDate: row.CreatedDate
  };
}

async function getCasesByContactId(contactId) {
  const safeContactId = String(contactId || '').trim().replace(/'/g, "\\'");
  if (!safeContactId) {
    throw new Error('contactId is required.');
  }

  const soql = [
    'SELECT Id,CaseNumber,Subject,Status,Priority,CreatedDate',
    `FROM Case WHERE ContactId='${safeContactId}'`,
    'ORDER BY CreatedDate DESC LIMIT 100'
  ].join(' ');

  const records = await queryRecords(soql);
  return records.map(row => ({
    id: row.Id,
    caseNumber: row.CaseNumber,
    subject: row.Subject,
    status: row.Status,
    priority: row.Priority,
    createdDate: row.CreatedDate
  }));
}

async function searchKnowledgeArticles(searchTerm) {
  const normalized = String(searchTerm || '').trim().replace(/'/g, "\\'");
  const whereClause = normalized
    ? `AND (Title LIKE '%${normalized}%' OR Summary LIKE '%${normalized}%' OR FAQ_Answer__c LIKE '%${normalized}%')`
    : '';
  const objectCandidates = ['Knowledge__kav', 'KnowledgeArticleVersion'];
  let lastError = null;
  const fieldCandidates = [
    'Id,Title,Summary,FAQ_Answer__c,LastPublishedDate',
    'Id,Title,Summary,LastPublishedDate'
  ];

  for (const objectName of objectCandidates) {
    for (const fields of fieldCandidates) {
      try {
        const soql = [
          `SELECT ${fields}`,
          `FROM ${objectName}`,
          "WHERE PublishStatus='Online' AND Language='en_US'",
          whereClause,
          'ORDER BY LastPublishedDate DESC LIMIT 8'
        ].join(' ');

        const records = await queryRecords(soql);
        return records.map(row => ({
          id: row.Id,
          title: row.Title,
          summary: row.Summary,
          faqAnswer: row.FAQ_Answer__c || '',
          lastPublishedDate: row.LastPublishedDate
        }));
      } catch (err) {
        lastError = err;
      }
    }
  }

  throw lastError || new Error('Unable to query Salesforce Knowledge.');
}

async function getCaseComments(caseId) {
  const safeCaseId = String(caseId || '').replace(/'/g, "\\'");
  const soql = [
    'SELECT Id,CommentBody,CreatedDate,CreatedBy.Name',
    `FROM CaseComment WHERE ParentId='${safeCaseId}'`,
    'ORDER BY CreatedDate ASC LIMIT 100'
  ].join(' ');
  const records = await queryRecords(soql);
  return records.map(row => ({
    id: row.Id,
    commentBody: row.CommentBody,
    createdDate: row.CreatedDate,
    createdByName: row.CreatedBy ? row.CreatedBy.Name : ''
  }));
}

async function addCaseComment(caseId, commentBody) {
  if (!caseId || !commentBody) {
    throw new Error('caseId and commentBody are required.');
  }
  const result = await sfRequest('POST', 'sobjects/CaseComment', {
    ParentId: caseId,
    CommentBody: commentBody,
    IsPublished: true
  });
  return { id: result.id };
}

async function uploadCaseFile({ caseId, fileName, contentType, dataBase64 }) {
  if (!caseId || !fileName || !dataBase64) {
    throw new Error('caseId, fileName, and dataBase64 are required.');
  }

  const version = await sfRequest('POST', 'sobjects/ContentVersion', {
    Title: fileName,
    PathOnClient: fileName,
    VersionData: dataBase64
  });

  const records = await queryRecords(
    `SELECT ContentDocumentId FROM ContentVersion WHERE Id='${version.id}' LIMIT 1`
  );
  if (records.length === 0 || !records[0].ContentDocumentId) {
    throw new Error('Uploaded file could not be linked.');
  }

  await sfRequest('POST', 'sobjects/ContentDocumentLink', {
    ContentDocumentId: records[0].ContentDocumentId,
    LinkedEntityId: caseId,
    ShareType: 'V',
    Visibility: 'AllUsers'
  });

  return {
    contentVersionId: version.id,
    contentDocumentId: records[0].ContentDocumentId,
    contentType: contentType || ''
  };
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
  const conversationId = randomUUID().toLowerCase();

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
        id: randomUUID().toLowerCase(),
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

  function normalizeSenderRole(rawRole) {
    const normalized = String(rawRole || '').toLowerCase();
    if (normalized === 'enduser') return 'endUser';
    if (normalized === 'chatbot' || normalized === 'agent') return 'agent';
    return 'system';
  }

  const parsed = conversationEntries
    .filter(entry => entry.entryType === 'Message')
    .map(entry => {
      const payload = entry.entryPayload && entry.entryPayload.abstractMessage;
      const text = payload && payload.staticContent ? payload.staticContent.text : null;
      return {
        id: payload && payload.id ? payload.id : `${entry.serverTimestamp || Date.now()}`,
        senderRole: normalizeSenderRole(entry.sender && entry.sender.role),
        text,
        timestamp: entry.serverTimestamp || entry.clientTimestamp || 0
      };
    })
    .filter(entry => !!entry.text)
    .sort((a, b) => a.timestamp - b.timestamp);

  return parsed;
}

async function endMessagingSession({ accessToken, conversationId }) {
  const host = getMessagingHost();
  const developerName = process.env.SF_MESSAGING_DEPLOYMENT_NAME;

  if (!accessToken || !conversationId || !developerName) {
    throw new Error('Missing end-session payload.');
  }

  const response = await fetch(
    `https://${host}/iamessage/api/v2/conversation/${conversationId}?esDeveloperName=${encodeURIComponent(developerName)}`,
    {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    }
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Messaging end failed (${response.status}): ${error}`);
  }

  return { success: true };
}

module.exports = {
  createCase,
  createTask,
  queryContact,
  updateContact,
  getCaseByReference,
  getCasesByContactId,
  searchKnowledgeArticles,
  getCaseComments,
  addCaseComment,
  uploadCaseFile,
  initializeMessagingSession,
  sendMessagingMessage,
  getMessagingMessages,
  endMessagingSession
};
