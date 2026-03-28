exports.handler = async function(event, context) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const { prompt, card, reversed, email, action } = JSON.parse(event.body);

    const AIRTABLE_BASE_ID = 'appY0QrFxt71E2oqI';
    const AIRTABLE_TABLE   = 'tbl3eGN7tW1HKyyX4';
    const AIRTABLE_URL     = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${AIRTABLE_TABLE}`;
    const AIRTABLE_HEADERS = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.AIRTABLE_TOKEN}`
    };

    // ── Resonance update only ────────────────────────────────────────────
    if (action === 'resonance') {
      // Find most recent record for this email+prompt and update resonance
      const searchRes = await fetch(
        `${AIRTABLE_URL}?filterByFormula=AND({User}="${email}",{Entry Prompt Chosen}="${prompt}")&sort[0][field]=Session Date&sort[0][direction]=desc&maxRecords=1`,
        { headers: AIRTABLE_HEADERS }
      );
      const searchData = await searchRes.json();

      if (searchData.records && searchData.records.length > 0) {
        const recordId = searchData.records[0].id;
        await fetch(`${AIRTABLE_URL}/${recordId}`, {
          method: 'PATCH',
          headers: AIRTABLE_HEADERS,
          body: JSON.stringify({
            fields: { 'Resonance Score': card } // reuse card param for score
          })
        });
      }

      return {
        statusCode: 200,
        headers: { 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({ ok: true })
      };
    }

    // ── Generate reading ─────────────────────────────────────────────────
    const reversedNote = reversed
      ? 'ไพ่ใบนี้จั่วออกมาในท่ากลับหัว (Reversed) — ความหมายจะเป็นด้านที่ถูกบล็อก ถูกกักไว้ หรือพลังงานที่ยังไม่ถูกปลดปล่อย'
      : 'ไพ่ใบนี้จั่วออกมาในท่าตรง (Upright)';

    const systemPrompt = `คุณคือ Mora นักอ่านไพ่ทาโรต์ที่มีปรัชญาหนึ่งเดียว: "ความชัดเจนสำคัญกว่าความสบายใจ"

กฎการอ่านไพ่:
- ใช้ภาษาไทยที่อบอุ่น สงบ ไม่เร่งรีบ
- เชื่อมไพ่กับความรู้สึกที่ user บอกมาโดยตรง — ใช้คำของเขากลับไปหาเขา
- ${reversedNote}
- สำหรับไพ่กลับหัว: อ่านถึงพลังงานที่ถูกกักไว้ สิ่งที่ยังไม่เกิด หรือสิ่งที่ต้องปลดปล่อย
- อย่าบอกว่า "คุณควร..." — ใช้ "บางทีมันอาจจะ..." หรือ "ไพ่ใบนี้ชวนให้คิดว่า..."
- จบด้วยคำถามที่ user เอาไปนั่งคิดคนเดียวได้คืนนี้

ตอบใน JSON format นี้เท่านั้น ไม่มี markdown หรือ backtick:
{"reading": "การตีความ 3-4 ประโยค", "question": "คำถามปิด 1 ประโยค"}`;

    const claudeRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.CLAUDE_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 600,
        system: systemPrompt,
        messages: [{ role: 'user', content: `User รู้สึก: "${prompt}"\nไพ่ที่จั่วได้: ${card}\n${reversed ? '(ไพ่กลับหัว)' : '(ไพ่ตรง)'}` }]
      })
    });

    const claudeData = await claudeRes.json();
    const text = claudeData.content[0].text;
    const clean = text.replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(clean);

    // ── Save to Airtable ─────────────────────────────────────────────────
    const airtableRes = await fetch(AIRTABLE_URL, {
      method: 'POST',
      headers: AIRTABLE_HEADERS,
      body: JSON.stringify({
        fields: {
          'User': email || 'guest',
          'Entry Prompt Chosen': prompt,
          'Card Drawn': card,
          'Interpretation': parsed.reading,
          'Closing Question': parsed.question,
          'Resonance Score': 'pending',
          'Themes Tagged': detectTheme(prompt),
          'Session Date': new Date().toISOString().split('T')[0]
        }
      })
    });

    const airtableData = await airtableRes.json();
    console.log('Airtable response:', JSON.stringify(airtableData));

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        reading: parsed.reading,
        question: parsed.question
      })
    };

  } catch (err) {
    console.error('Error:', err.message);
    return {
      statusCode: 500,
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({
        reading: 'ไพ่กำลังพูดอะไรบางอย่าง แต่เสียงยังไม่ชัด ลองถามใหม่อีกครั้ง',
        question: 'มีอะไรที่คุณอยากถามอีกครั้งไหม?'
      })
    };
  }
};

function detectTheme(prompt) {
  const p = prompt.toLowerCase();
  if (p.includes('งาน') || p.includes('ออก') || p.includes('เลื่อนขั้น')) return 'work';
  if (p.includes('แฟน') || p.includes('ความสัมพันธ์') || p.includes('รัก')) return 'relationship';
  if (p.includes('เงิน') || p.includes('หวย')) return 'money';
  if (p.includes('ตัวเอง') || p.includes('ชีวิต') || p.includes('เปลี่ยน')) return 'identity';
  if (p.includes('กลัว') || p.includes('กังวล') || p.includes('เครียด')) return 'fear';
  return 'change';
}
