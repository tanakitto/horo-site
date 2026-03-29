exports.handler = async function(event, context) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const { prompt, card, reversed, email, history, readingType, lang } = JSON.parse(event.body);
    const language = lang || 'th';

    const AIRTABLE_BASE_ID = 'appY0QrFxt71E2oqI';
    const AIRTABLE_TABLE   = 'tbl3eGN7tW1HKyyX4';
    const AIRTABLE_URL     = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${AIRTABLE_TABLE}`;
    const AIRTABLE_HEADERS = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${process.env.AIRTABLE_TOKEN}` };

    // ── Build history context ─────────────────────────────────────────────
    let historyContext = '';
    let sessionNumber = 1;
    if (history && history.length > 0) {
      sessionNumber = history.length + 1;
      const last = history[0];
      historyContext = `
ข้อมูลจาก session ก่อนหน้า:
- ครั้งที่แล้ว user รู้สึก: "${last.prompt}"
- สัญลักษณ์ที่จั่วได้: ${last.card}
- คำถามที่ให้ไว้: "${last.question}"
- User บอกว่าตรงไหม: ${last.resonance || 'ไม่ได้ระบุ'}
นี่คือ session ที่ ${sessionNumber} ของ user คนนี้`;
    }

    const isReturning = history && history.length > 0;


    const langNote = language === 'en'
      ? 'Respond entirely in English. Keep the tone warm, thoughtful, like a wise counselor.'
      : language === 'jp'
      ? '日本語で返答してください。温かく、思慮深い口調で、賢明なカウンセラーのように。'
      : 'ตอบเป็นภาษาไทยทั้งหมด ใช้ภาษาที่อบอุ่น สงบ ไม่เร่งรีบ';

    // ── Build system prompt by reading type ───────────────────────────────
    let systemPrompt = '';

    if (readingType === 'rune') {
      systemPrompt = `คุณคือ Mora นักอ่านอักษรรูนที่มีปรัชญาหนึ่งเดียว: "ความชัดเจนสำคัญกว่าความสบายใจ"
${historyContext}

กฎการอ่านรูน:
- ใช้ภาษาไทยที่อบอุ่น สงบ ไม่เร่งรีบ
- เชื่อมรูนกับความรู้สึกที่ user บอกมาโดยตรง
- ${reversed ? 'รูนนี้กลับหัว — อ่านถึงพลังงานที่ถูกบล็อก หรือสิ่งที่ต้องปลดปล่อย' : 'รูนนี้ตรง — อ่านพลังงานที่ไหลได้เต็มที่'}
- ${isReturning ? 'User นี้กลับมาแล้ว — อ้างอิง session ก่อนหน้าอย่างเป็นธรรมชาติ' : 'Session แรก — ไม่ต้องอ้างอิงอะไร'}
- อย่าบอกว่า "คุณควร..." ใช้ "บางทีมันอาจจะ..." หรือ "รูนใบนี้ชวนให้คิดว่า..."
- จบด้วยคำถาม 1 ข้อ

${langNote}

ตอบใน JSON เท่านั้น ไม่มี markdown:
{"reading": "การตีความ 3-4 ประโยค", "question": "คำถามปิด 1 ประโยค"}`;

    } else if (readingType === 'three') {
      systemPrompt = `คุณคือ Mora นักอ่านไพ่ทาโรต์ที่มีปรัชญาหนึ่งเดียว: "ความชัดเจนสำคัญกว่าความสบายใจ"
${historyContext}

กฎการอ่านไพ่ 3 ใบ (Past / Present / Future):
- ใช้ภาษาไทยที่อบอุ่น สงบ
- ไพ่ 3 ใบคือ Past · Present · Future — อ่านให้ครบทั้ง 3 มิติ
- เชื่อมทุกใบกับความรู้สึกที่ user บอกมา
- ${isReturning ? 'User นี้กลับมาแล้ว — อ้างอิง session ก่อนหน้าอย่างเป็นธรรมชาติ' : 'Session แรก'}
- จบด้วยคำถาม 1 ข้อที่เชื่อม past-present-future เข้าด้วยกัน

${langNote}

ตอบใน JSON เท่านั้น ไม่มี markdown:
{"reading": "การตีความครบทั้ง 3 ใบ 5-6 ประโยค", "question": "คำถามปิด 1 ประโยค"}`;

    } else {
      const reversedNote = reversed
        ? 'ไพ่ใบนี้กลับหัว (Reversed) — ความหมายจะเป็นด้านที่ถูกบล็อก ถูกกักไว้'
        : 'ไพ่ใบนี้ตรง (Upright)';

      systemPrompt = `คุณคือ Mora นักอ่านไพ่ทาโรต์ที่มีปรัชญาหนึ่งเดียว: "ความชัดเจนสำคัญกว่าความสบายใจ"
${historyContext}

กฎการอ่านไพ่:
- ใช้ภาษาไทยที่อบอุ่น สงบ ไม่เร่งรีบ
- เชื่อมไพ่กับความรู้สึกที่ user บอกมาโดยตรง — ใช้คำของเขากลับไปหาเขา
- ${reversedNote}
- ${isReturning ? 'User นี้กลับมาแล้ว — อ้างอิง session ก่อนหน้าอย่างเป็นธรรมชาติ' : 'Session แรก — ไม่ต้องอ้างอิงอะไร'}
- อย่าบอกว่า "คุณควร..." ใช้ "บางทีมันอาจจะ..." หรือ "ไพ่ใบนี้ชวนให้คิดว่า..."
- จบด้วยคำถาม 1 ข้อ

${langNote}

ตอบใน JSON เท่านั้น ไม่มี markdown:
{"reading": "การตีความ 3-4 ประโยค", "question": "คำถามปิด 1 ประโยค"}`;
    }

    // ── Call Claude ───────────────────────────────────────────────────────
    const claudeRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': process.env.CLAUDE_API_KEY, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 700,
        system: systemPrompt,
        messages: [{ role: 'user', content: `User รู้สึก: "${prompt}"\nสัญลักษณ์ที่จั่วได้: ${card}` }]
      })
    });

    const claudeData = await claudeRes.json();
    const text = claudeData.content[0].text;
    const clean = text.replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(clean);

    // ── Save to Airtable ──────────────────────────────────────────────────
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
    console.log('Airtable:', JSON.stringify(airtableData));

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ reading: parsed.reading, question: parsed.question, sessionNumber })
    };

  } catch (err) {
    console.error('Error:', err.message);
    return {
      statusCode: 500,
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ reading: 'สัญลักษณ์กำลังพูดอะไรบางอย่าง แต่เสียงยังไม่ชัด ลองถามใหม่อีกครั้ง', question: 'มีอะไรที่คุณอยากถามอีกครั้งไหม?' })
    };
  }
};

function detectTheme(prompt) {
  const p = prompt.toLowerCase();
  if (p.includes('งาน')||p.includes('ออก')||p.includes('เลื่อนขั้น')) return 'work';
  if (p.includes('แฟน')||p.includes('ความสัมพันธ์')||p.includes('รัก')) return 'relationship';
  if (p.includes('เงิน')||p.includes('หวย')) return 'money';
  if (p.includes('ตัวเอง')||p.includes('ชีวิต')||p.includes('เปลี่ยน')) return 'identity';
  if (p.includes('กลัว')||p.includes('กังวล')||p.includes('เครียด')) return 'fear';
  return 'change';
}
