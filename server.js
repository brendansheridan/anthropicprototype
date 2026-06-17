require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const sf = require('./sf');
const { getResponse } = require('./conversation');
const { getConciergeResponse } = require('./concierge-conversation');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Chat endpoint
app.post('/api/chat', async (req, res) => {
  try {
    const { message, conversationHistory } = req.body;

    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }

    // Get scripted response and determine actions
    const result = getResponse(message, conversationHistory || []);

    // Execute Salesforce actions if needed
    const actions = [];

    if (result.action === 'create_case') {
      try {
        const caseResult = await sf.createCase({
          Subject: result.caseData.subject,
          Description: result.caseData.description,
          Status: 'New',
          Priority: 'Medium',
          Origin: 'Chat'
        });
        actions.push({
          type: 'case_created',
          caseId: caseResult.id,
          caseNumber: caseResult.caseNumber
        });
        // Replace placeholder in response with actual case number
        result.response = result.response.replace(
          '{{CASE_NUMBER}}',
          caseResult.caseNumber || caseResult.id
        );
      } catch (err) {
        console.error('Failed to create case:', err.message);
        result.response = result.response.replace(
          '{{CASE_NUMBER}}',
          'SF-' + Date.now().toString().slice(-6)
        );
        actions.push({ type: 'case_created', caseId: 'demo-mode', error: err.message });
      }
    }

    if (result.action === 'create_task') {
      try {
        const taskResult = await sf.createTask({
          Subject: result.taskData.subject,
          Description: result.taskData.description,
          Status: 'Not Started',
          Priority: 'Normal'
        });
        actions.push({ type: 'task_created', taskId: taskResult.id });
      } catch (err) {
        console.error('Failed to create task:', err.message);
        actions.push({ type: 'task_created', taskId: 'demo-mode', error: err.message });
      }
    }

    res.json({
      response: result.response,
      actions,
      conversationState: result.newState
    });
  } catch (err) {
    console.error('Chat error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Concierge chat endpoint
app.post('/api/concierge/chat', (req, res) => {
  try {
    const { message, conversationHistory } = req.body;
    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }
    const result = getConciergeResponse(message, conversationHistory || []);
    res.json({
      response: result.response,
      card: result.card,
      conversationState: result.newState
    });
  } catch (err) {
    console.error('Concierge chat error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Custom Messaging API routes for Claude-styled help drawer
app.post('/api/messaging/session', async (req, res) => {
  try {
    const session = await sf.initializeMessagingSession();
    res.json(session);
  } catch (err) {
    console.error('Messaging session init error:', err.message);
    res.status(500).json({ error: 'Unable to initialize messaging session.' });
  }
});

app.post('/api/messaging/message', async (req, res) => {
  try {
    const { accessToken, conversationId, message } = req.body || {};
    if (!accessToken || !conversationId || !message) {
      return res.status(400).json({ error: 'accessToken, conversationId, and message are required.' });
    }
    await sf.sendMessagingMessage({
      accessToken,
      conversationId,
      text: message
    });
    res.json({ ok: true });
  } catch (err) {
    console.error('Messaging send error:', err.message);
    res.status(500).json({ error: 'Unable to send messaging chat message.' });
  }
});

app.post('/api/messaging/messages', async (req, res) => {
  try {
    const { accessToken, conversationId } = req.body || {};
    if (!accessToken || !conversationId) {
      return res.status(400).json({ error: 'accessToken and conversationId are required.' });
    }
    const entries = await sf.getMessagingMessages({ accessToken, conversationId });
    res.json({ entries });
  } catch (err) {
    console.error('Messaging fetch error:', err.message);
    res.status(500).json({ error: 'Unable to load messaging chat messages.' });
  }
});

app.post('/api/messaging/end', async (req, res) => {
  try {
    const { accessToken, conversationId } = req.body || {};
    if (!accessToken || !conversationId) {
      return res.status(400).json({ error: 'accessToken and conversationId are required.' });
    }
    const result = await sf.endMessagingSession({ accessToken, conversationId });
    res.json(result);
  } catch (err) {
    console.error('Messaging end error:', err.message);
    res.status(500).json({ error: 'Unable to end messaging session.' });
  }
});

// Headless Help Case APIs
app.post('/api/help/cases', async (req, res) => {
  try {
    const { subject, description, type, email } = req.body || {};
    if (!subject || !description) {
      return res.status(400).json({ error: 'subject and description are required.' });
    }
    const caseResult = await sf.createCase({
      Subject: subject,
      Description: description,
      Status: 'New',
      Priority: type === 'Billing' ? 'High' : 'Medium',
      Type: type || 'General',
      Origin: 'Web',
      SuppliedEmail: email || undefined
    });
    res.json({ case: caseResult });
  } catch (err) {
    console.error('Help case create error:', err.message);
    res.status(500).json({ error: 'Unable to create support case.' });
  }
});

app.get('/api/help/cases/:caseRef', async (req, res) => {
  try {
    const caseRef = req.params.caseRef;
    const caseRecord = await sf.getCaseByReference(caseRef);
    const comments = await sf.getCaseComments(caseRecord.id);
    res.json({ case: caseRecord, comments });
  } catch (err) {
    const notFound = /not found/i.test(err.message || '');
    console.error('Help case lookup error:', err.message);
    res.status(notFound ? 404 : 500).json({ error: notFound ? 'Case not found.' : 'Unable to load case.' });
  }
});

app.post('/api/help/cases/:caseId/comments', async (req, res) => {
  try {
    const { caseId } = req.params;
    const { commentBody } = req.body || {};
    if (!commentBody) {
      return res.status(400).json({ error: 'commentBody is required.' });
    }
    const result = await sf.addCaseComment(caseId, commentBody);
    res.json(result);
  } catch (err) {
    console.error('Help case comment error:', err.message);
    res.status(500).json({ error: 'Unable to add case comment.' });
  }
});

app.post('/api/help/cases/:caseId/files', async (req, res) => {
  try {
    const { caseId } = req.params;
    const { fileName, contentType, dataBase64 } = req.body || {};
    const result = await sf.uploadCaseFile({ caseId, fileName, contentType, dataBase64 });
    res.json(result);
  } catch (err) {
    console.error('Help case file upload error:', err.message);
    res.status(500).json({ error: 'Unable to upload case file.' });
  }
});

// Concierge page
app.get('/concierge', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'concierge', 'index.html'));
});

// Fallback to index.html for SPA
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Open http://localhost:${PORT} in your browser`);
});
