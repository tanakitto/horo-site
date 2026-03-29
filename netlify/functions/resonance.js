exports.handler = async function(event, context) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const { email, prompt, score } = JSON.parse(event.body);

    if (!email || email === 'guest' || !score) {
      return {
        statusCode: 200,
        headers: { 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({ ok: false, reason: 'no email or score' })
      };
    }

    const AIRTABLE_BASE_ID = 'appY0QrFxt71E2oqI';
    const AIRTABLE_TABLE   = 'tbl3eGN7tW1HKyyX4';
    const AIRTABLE_URL     = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${AIRTABLE_TABLE}`;
    const AIRTABLE_HEADERS = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.AIRTABLE_TOKEN}`
    };

    // Get most recent record with 'pending' resonance score
    const searchUrl = `${AIRTABLE_URL}?sort[0][field]=Session Date&sort[0][direction]=desc&maxRecords=5`;
    const searchRes = await fetch(searchUrl, { headers: AIRTABLE_HEADERS });
    const searchData = await searchRes.json();
    console.log('Search result:', JSON.stringify(searchData));

    if (!searchData.records || searchData.records.length === 0) {
      return {
        statusCode: 200,
        headers: { 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({ ok: false, reason: 'no records found' })
      };
    }

    // Find most recent record matching this email with pending score
    const record = searchData.records.find(r =>
      r.fields['User'] === email &&
      r.fields['Resonance Score'] === 'pending'
    );

    if (!record) {
      // Fallback: just update the most recent record regardless
      const fallback = searchData.records.find(r => r.fields['User'] === email);
      if (!fallback) {
        console.log('No record found for email:', email);
        return {
          statusCode: 200,
          headers: { 'Access-Control-Allow-Origin': '*' },
          body: JSON.stringify({ ok: false, reason: 'email not found' })
        };
      }

      const updateRes = await fetch(`${AIRTABLE_URL}/${fallback.id}`, {
        method: 'PATCH',
        headers: AIRTABLE_HEADERS,
        body: JSON.stringify({ fields: { 'Resonance Score': score } })
      });
      const updateData = await updateRes.json();
      console.log('Fallback update:', JSON.stringify(updateData));
      return {
        statusCode: 200,
        headers: { 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({ ok: true })
      };
    }

    // Update the pending record
    const updateRes = await fetch(`${AIRTABLE_URL}/${record.id}`, {
      method: 'PATCH',
      headers: AIRTABLE_HEADERS,
      body: JSON.stringify({ fields: { 'Resonance Score': score } })
    });
    const updateData = await updateRes.json();
    console.log('Update result:', JSON.stringify(updateData));

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ ok: true })
    };

  } catch (err) {
    console.error('Resonance error:', err.message);
    return {
      statusCode: 500,
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ ok: false })
    };
  }
};
