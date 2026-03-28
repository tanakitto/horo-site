exports.handler = async function(event, context) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const { email } = JSON.parse(event.body);

    if (!email || email === 'guest') {
      return {
        statusCode: 200,
        headers: { 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({ sessions: [], isReturning: false })
      };
    }

    const AIRTABLE_BASE_ID = 'appY0QrFxt71E2oqI';
    const AIRTABLE_TABLE   = 'tbl3eGN7tW1HKyyX4';
    const encodedEmail = encodeURIComponent(email);

    const res = await fetch(
      `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${AIRTABLE_TABLE}?filterByFormula={User}="${encodedEmail}"&sort[0][field]=Session Date&sort[0][direction]=desc&maxRecords=3`,
      {
        headers: {
          'Authorization': `Bearer ${process.env.AIRTABLE_TOKEN}`
        }
      }
    );

    const data = await res.json();
    console.log('History fetch:', JSON.stringify(data));

    if (!data.records || data.records.length === 0) {
      return {
        statusCode: 200,
        headers: { 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({ sessions: [], isReturning: false })
      };
    }

    const sessions = data.records.map(r => ({
      prompt: r.fields['Entry Prompt Chosen'] || '',
      card: r.fields['Card Drawn'] || '',
      question: r.fields['Closing Question'] || '',
      resonance: r.fields['Resonance Score'] || '',
      date: r.fields['Session Date'] || '',
      theme: r.fields['Themes Tagged'] || ''
    }));

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        sessions,
        isReturning: sessions.length > 0
      })
    };

  } catch (err) {
    console.error('History error:', err.message);
    return {
      statusCode: 500,
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ sessions: [], isReturning: false })
    };
  }
};
