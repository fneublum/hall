const twilio = require('twilio');

let client = null;

function getClient() {
  if (!client && process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN) {
    client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
  }
  return client;
}

async function sendSMS(to, body) {
  const twilioClient = getClient();
  if (!twilioClient) {
    throw new Error('Twilio not configured');
  }

  const message = await twilioClient.messages.create({
    body,
    from: process.env.TWILIO_PHONE_NUMBER,
    to
  });

  return {
    id: message.sid,
    status: message.status,
    to: message.to,
    body: message.body
  };
}

async function sendWhatsApp(to, body) {
  const twilioClient = getClient();
  if (!twilioClient) {
    throw new Error('Twilio not configured');
  }

  // Ensure WhatsApp format
  const whatsappTo = to.startsWith('whatsapp:') ? to : `whatsapp:${to}`;
  
  const message = await twilioClient.messages.create({
    body,
    from: process.env.TWILIO_WHATSAPP_NUMBER || 'whatsapp:+14155238886',
    to: whatsappTo
  });

  return {
    id: message.sid,
    status: message.status,
    to: message.to,
    body: message.body
  };
}

async function getMessages(limit = 20) {
  const twilioClient = getClient();
  if (!twilioClient) {
    return [];
  }

  const messages = await twilioClient.messages.list({ limit });
  
  return messages.map(msg => ({
    id: msg.sid,
    from: msg.from,
    to: msg.to,
    body: msg.body,
    status: msg.status,
    direction: msg.direction,
    timestamp: msg.dateCreated,
    isWhatsApp: msg.from?.startsWith('whatsapp:') || msg.to?.startsWith('whatsapp:')
  }));
}

async function getSMSMessages(limit = 20) {
  const messages = await getMessages(limit);
  return messages.filter(m => !m.isWhatsApp);
}

async function getWhatsAppMessages(limit = 20) {
  const messages = await getMessages(limit);
  return messages.filter(m => m.isWhatsApp);
}

module.exports = {
  sendSMS,
  sendWhatsApp,
  getMessages,
  getSMSMessages,
  getWhatsAppMessages
};
