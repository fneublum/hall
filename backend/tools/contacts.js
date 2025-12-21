const { google } = require('googleapis');

const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URI
);

oauth2Client.setCredentials({
  refresh_token: process.env.GOOGLE_REFRESH_TOKEN
});

const people = google.people({ version: 'v1', auth: oauth2Client });

async function search({ query }) {
  const res = await people.people.searchContacts({
    query,
    readMask: 'names,emailAddresses,phoneNumbers',
    pageSize: 10
  });

  return {
    contacts: (res.data.results || []).map(r => ({
      resourceName: r.person.resourceName,
      name: r.person.names?.[0]?.displayName,
      email: r.person.emailAddresses?.[0]?.value,
      phone: r.person.phoneNumbers?.[0]?.value
    }))
  };
}

async function create({ name, email, phone }) {
  const contact = {
    names: [{ givenName: name }],
    emailAddresses: email ? [{ value: email }] : [],
    phoneNumbers: phone ? [{ value: phone }] : []
  };

  const res = await people.people.createContact({
    requestBody: contact
  });

  return { success: true, resourceName: res.data.resourceName };
}

async function update({ resourceName, name, email, phone }) {
  const contact = {
    names: name ? [{ givenName: name }] : undefined,
    emailAddresses: email ? [{ value: email }] : undefined,
    phoneNumbers: phone ? [{ value: phone }] : undefined
  };

  const res = await people.people.updateContact({
    resourceName,
    updatePersonFields: 'names,emailAddresses,phoneNumbers',
    requestBody: contact
  });

  return { success: true, resourceName: res.data.resourceName };
}

module.exports = { search, create, update };
