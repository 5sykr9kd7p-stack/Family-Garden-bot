require("dotenv").config();
const express = require("express");
const axios = require("axios");
const app = express();
app.use(express.json());

const SYSTEM_PROMPT = `Та Family Garden хотхоны борлуулалтын туслах chatbot юм.
Зөвхөн монгол хэлээр хариулна уу. Найрсаг, богино, тодорхой байдлаар хариулна уу.

ТӨСЛИЙН МЭДЭЭЛЭЛ:
- 10 блок, 2200 айлын орон сууц
- Хан уул дүүрэг, 8-р хороо, Морин тойруулгын чанх урд
- Төв замаас 450 метр

ӨРӨӨНҮҮД: 5A/6A(36.62м²), 5B/6B(47.08м²), 5C(52.15м²), 6C(52.03м²),
5G(51.35м²), 5H(52.11м²), 5J/6J(50.21м²), 5K/6K(45.83м²),
5E/6E(68.56м²), 6G(62.22м²), 6H(63.28м²)

ҮНЭ (м² үнэ):
2-8 давхар: 40%→4,450,000₮ | 60%→4,250,000₮ | 90%→4,150,000₮
9-15 давхар: 40%→4,500,000₮ | 60%→4,300,000₮ | 90%→4,200,000₮

БАНКНЫ ЗЭЭЛ: Капитрон банк, жилийн 14%, сарын 1.25%, 15-20 жил

МЕНЕЖЕРҮҮД:
- Манлай: 9979-3374
- Энэбиш: 8060-1020
- Урнаа: 8888-1482
- Удвал: 7272-7770
- Дэлгэрмөрөн: 7272-7770

Хэрэглэгч цаг авах гэвэл нэр, утас, урьдчилгааны дүнг асуу.`;

const userSessions = {};

app.get("/webhook", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];
  if (mode === "subscribe" && token === process.env.VERIFY_TOKEN) {
    res.status(200).send(challenge);
  } else {
    res.sendStatus(403);
  }
});

app.post("/webhook", async (req, res) => {
  const body = req.body;
  if (body.object !== "page") return res.sendStatus(404);
  for (const entry of body.entry) {
    for (const event of entry.messaging) {
      if (!event.message?.text) continue;
      const senderId = event.sender.id;
      const userText = event.message.text;
      if (!userSessions[senderId]) userSessions[senderId] = [];
      userSessions[senderId].push({ role: "user", content: userText });
      const history = userSessions[senderId].slice(-10);
      try {
        const claudeRes = await axios.post(
          "https://api.anthropic.com/v1/messages",
          { model: "claude-haiku-4-5-20251001", max_tokens: 500,
            system: SYSTEM_PROMPT, messages: history },
          { headers: { "x-api-key": process.env.ANTHROPIC_API_KEY,
            "anthropic-version": "2023-06-01",
            "Content-Type": "application/json" } }
        );
        const reply = claudeRes.data.content[0].text;
        userSessions[senderId].push({ role: "assistant", content: reply });
        await sendMessage(senderId, reply);
      } catch (err) {
        console.error("Алдаа:", err.message);
        await sendMessage(senderId, "Уучлаарай, түр алдаа гарлаа.");
      }
    }
  }
  res.sendStatus(200);
});

async function sendMessage(recipientId, text) {
  const chunks = [];
  for (let i = 0; i < text.length; i += 1900) chunks.push(text.slice(i, i + 1900));
  for (const chunk of chunks) {
    await axios.post(
      `https://graph.facebook.com/v18.0/me/messages?access_token=${process.env.PAGE_ACCESS_TOKEN}`,
      { recipient: { id: recipientId }, message: { text: chunk } }
    );
  }
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server: ${PORT}`));
