require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const sf = require('./sf');
const { getResponse } = require('./conversation');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
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

// Fallback to index.html for SPA
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Open http://localhost:${PORT} in your browser`);
});
