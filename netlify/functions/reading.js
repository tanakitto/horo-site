exports.handler = async function(event, context) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const { prompt, card, reversed, email } = JSON.parse(event.body);

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

    const userMessage = `User รู้สึก: "${prompt}"
ไพ่ที่จั่วได้: ${card}
${reversed ? '(ไพ่กลับหัว)' : '(ไพ่ตรง)'}

อ่านไพ่ใบนี้ให้ user คนนี้`;

    // ── Call Claude API ──────────────────────────────────────────────────
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
        messages: [{ role: 'user', content: userMessage }]
      })
    });

    const claudeData = await claudeRes.json();

    if (!claudeData.content || !claudeData.content[0]) {
      throw new Error('No content from Claude');
    }

    const text = claudeData.content[0].text;
    const clean = text.replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(clean);

    // ── Save to Airtable ─────────────────────────────────────────────────
    const AIRTABLE_BASE_ID = 'appY0QrFxt71E2oqI';
    const AIRTABLE_TABLE_ID = 'tblxbcHLIzwynN10A';

    const airtablePayload = {
      fields: {
        Email: email || 'guest',
        'Entry Prompt Chosen': prompt,
        'Card Drawn': card,
        'Resonance Score': 'pending',
        'Session Date': new Date().toISOString().split('T')[0],
        'Session Number': 1,
        'Themes Tagged': detectTheme(prompt),
      }
    };

    // Save to Airtable async (don't wait — don't block the reading response)
    fetch(`https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${AIRTABLE_TABLE_ID}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.AIRTABLE_TOKEN}`
      },
      body: JSON.stringify(airtablePayload)
    }).catch(err => console.error('Airtable save error:', err));

    // ── Return reading immediately ───────────────────────────────────────
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
    console.error('Error:', err);
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

// ── Detect theme from prompt ───────────────────────────────────────────────
function detectTheme(prompt) {
  const p = prompt.toLowerCase();
  if (p.includes('งาน') || p.includes('work') || p.includes('เลื่อนขั้น') || p.includes('ออก')) return 'work';
  if (p.includes('แฟน') || p.includes('ความสัมพันธ์') || p.includes('รัก') || p.includes('love')) return 'relationship';
  if (p.includes('เงิน') || p.includes('เงิน') || p.includes('หวย') || p.includes('money')) return 'money';
  if (p.includes('ตัวเอง') || p.includes('ชีวิต') || p.includes('เปลี่ยน')) return 'identity';
  if (p.includes('กลัว') || p.includes('กังวล') || p.includes('เครียด')) return 'fear';
  return 'change';
}
