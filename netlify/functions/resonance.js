exports.handler = async function(event, context) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const { email, prompt, score } = JSON.parse(event.body);

    const AIRTABLE_BASE_ID = 'appY0QrFxt71E2oqI';
    const AIRTABLE_TABLE   = 'tbl3eGN7tW1HKyyX4';
    const AIRTABLE_URL     = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${AIRTABLE_TABLE}`;
    const AIRTABLE_HEADERS = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.AIRTABLE_TOKEN}`
    };

    // Find most recent record for this email
    const encodedEmail = encodeURIComponent(email || 'guest');
    const searchRes = await fetch(
      `${AIRTABLE_URL}?filterByFormula={User}="${encodedEmail}"&sort[0][field]=Session Date&sort[0][direction]=desc&maxRecords=1`,
      { headers: AIRTABLE_HEADERS }
    );
    const searchData = await searchRes.json();
    console.log('Search result:', JSON.stringify(searchData));

    if (searchData.records && searchData.records.length > 0) {
      const recordId = searchData.records[0].id;
      const updateRes = await fetch(`${AIRTABLE_URL}/${recordId}`, {
        method: 'PATCH',
        headers: AIRTABLE_HEADERS,
        body: JSON.stringify({
          fields: { 'Resonance Score': score }
        })
      });
      const updateData = await updateRes.json();
      console.log('Update result:', JSON.stringify(updateData));
    }

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({ ok: true })
    };

  } catch (err) {
    console.error('Error:', err.message);
    return {
      statusCode: 500,
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ ok: false })
    };
  }
};
