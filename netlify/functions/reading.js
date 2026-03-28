exports.handler = async function(event, context) {
  // Only allow POST
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const { prompt, card } = JSON.parse(event.body);

    const systemPrompt = `คุณคือ Mora นักอ่านไพ่ทาโรต์ที่มีปรัชญาหนึ่งเดียว: "ความชัดเจนสำคัญกว่าความสบายใจ"

กฎการอ่านไพ่:
- ใช้ภาษาไทยที่อบอุ่น สงบ ไม่เร่งรีบ
- เชื่อมไพ่กับความรู้สึกที่ user เลือกโดยตรง — ใช้คำของเขากลับไป
- อย่าบอกว่า "คุณควร..." — ใช้ "บางทีมันอาจจะ..." หรือ "ไพ่ใบนี้ชวนให้คิดว่า..."
- จบด้วยคำถามที่ user เอาไปนั่งคิดคนเดียวได้คืนนี้

ตอบใน JSON format นี้เท่านั้น ไม่มี markdown:
{
  "reading": "การตีความไพ่ 3-4 ประโยค",
  "question": "คำถามปิด 1 ประโยค"
}`;

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.CLAUDE_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 500,
        system: systemPrompt,
        messages: [
          {
            role: 'user',
            content: `User เลือก: "${prompt}"\nไพ่ที่จั่วได้: ${card}\n\nอ่านไพ่ใบนี้ให้ user คนนี้`
          }
        ]
      })
    });

    const data = await response.json();
    const text = data.content[0].text;
    const clean = text.replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(clean);

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify(parsed)
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
