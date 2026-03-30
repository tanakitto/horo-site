exports.handler = async function(event, context) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const { email, score, sessionId } = JSON.parse(event.body);

    if (!score) {
      return {
        statusCode: 200,
        headers: { 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({ ok: false, reason: 'no score' })
      };
    }

    const AIRTABLE_BASE_ID = 'appY0QrFxt71E2oqI';
    const AIRTABLE_TABLE   = 'tbl3eGN7tW1HKyyX4';
    const AIRTABLE_URL     = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${AIRTABLE_TABLE}`;
    const HEADERS = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.AIRTABLE_TOKEN}`
    };

    let recordId = sessionId;

    // If no sessionId (older sessions or fallback), look up by email
    if (!recordId) {
      if (!email || email === 'guest') {
        return {
          statusCode: 200,
          headers: { 'Access-Control-Allow-Origin': '*' },
          body: JSON.stringify({ ok: false, reason: 'no sessionId and guest has no email fallback' })
        };
      }
      const searchRes = await fetch(
        `${AIRTABLE_URL}?sort%5B0%5D%5Bfield%5D=Session+Date&sort%5B0%5D%5Bdirection%5D=desc&maxRecords=10`,
        { headers: HEADERS }
      );
      const searchData = await searchRes.json();
      const pending = searchData.records?.find(r =>
        r.fields['User'] === email &&
        (r.fields['Resonance Score'] === 'pending' || !r.fields['Resonance Score'])
      );
      if (!pending) {
        return {
          statusCode: 200,
          headers: { 'Access-Control-Allow-Origin': '*' },
          body: JSON.stringify({ ok: false, reason: 'no pending record found for email' })
        };
      }
      recordId = pending.id;
    }

    const updateRes = await fetch(`${AIRTABLE_URL}/${recordId}`, {
      method: 'PATCH',
      headers: HEADERS,
      body: JSON.stringify({ fields: { 'Resonance Score': score } })
    });
    const updateData = await updateRes.json();
    console.log('Resonance updated:', recordId, '→', score);

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ ok: true, updated: recordId })
    };

  } catch (err) {
    console.error('Resonance error:', err.message);
    return {
      statusCode: 500,
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ ok: false, error: err.message })
    };
  }
};
