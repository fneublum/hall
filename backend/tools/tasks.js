const { google } = require('googleapis');

const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URI
);

oauth2Client.setCredentials({
  refresh_token: process.env.GOOGLE_REFRESH_TOKEN
});

const tasks = google.tasks({ version: 'v1', auth: oauth2Client });

// Get or create default task list
async function getTaskListId() {
  if (process.env.GOOGLE_TASKLIST_ID) return process.env.GOOGLE_TASKLIST_ID;
  
  const res = await tasks.tasklists.list();
  return res.data.items?.[0]?.id || '@default';
}

async function list({ showCompleted = false }) {
  const taskListId = await getTaskListId();
  
  const res = await tasks.tasks.list({
    tasklist: taskListId,
    showCompleted,
    showHidden: false
  });

  return {
    tasks: (res.data.items || []).map(t => ({
      id: t.id,
      title: t.title,
      notes: t.notes,
      due: t.due,
      status: t.status
    }))
  };
}

async function create({ title, notes, due }) {
  const taskListId = await getTaskListId();
  
  const task = {
    title,
    notes,
    due: due ? new Date(due).toISOString() : undefined
  };

  const res = await tasks.tasks.insert({
    tasklist: taskListId,
    requestBody: task
  });

  return { success: true, taskId: res.data.id };
}

async function complete({ taskId }) {
  const taskListId = await getTaskListId();
  
  const res = await tasks.tasks.patch({
    tasklist: taskListId,
    task: taskId,
    requestBody: {
      status: 'completed'
    }
  });

  return { success: true, taskId: res.data.id, completed: res.data.completed };
}

async function deleteTask({ taskId }) {
  const taskListId = await getTaskListId();
  
  await tasks.tasks.delete({
    tasklist: taskListId,
    task: taskId
  });

  return { success: true, deleted: taskId };
}

module.exports = { list, create, complete, delete: deleteTask };
