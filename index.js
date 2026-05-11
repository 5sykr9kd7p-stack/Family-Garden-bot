require("dotenv").config();
const express = require("express");
const axios = require("axios");
const app = express();
app.use(express.json());

app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "Content-Type");
  res.header("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  if (req.method === "OPTIONS") return res.sendStatus(200);
  next();
});

const SYSTEM_PROMPT = `Та Family Garden хотхоны борлуулалтын туслах chatbot юм.
Зөвхөн монгол хэлээр хариулна уу. Найрсаг, богино, тодорхой байдлаар хариулна уу.
ТӨСЛИЙН МЭДЭЭЛЭЛ: 10 блок, 2200 айл, Хан уул 8-р хороо, Морин тойруулгаас 450м
ҮНЭ: 2-8 давхар: 40%→4,350,000₮|60%→4,150,000₮|90%→4,050,000₮
9-15 давхар: 40%→4,400,000₮|60%→4,200,000₮|90%→4,100,000₮
БАНК: Капитрон, 14%, 15-20 жил
МЕНЕЖЕРҮҮД: Манлай:9979-3374, Энэбиш:8060-1020, Урнаа:8888-1482, Удвал/Дэлгэрмөрөн:7272-7770
Цаг авах гэвэл нэр, утас, урьдчилгаа асуу.`;

const userSessions = {};

app.post("/chat", async (req, res) => {
  const { messages } = req.body;
  if (!messages) return res.status(400).json({ error: "No messages" });
  try {
    const r = await axios.post("https://api.anthropic.com/v1/messages",
      { model: "claude-haiku-4-5-20251001", max_tokens: 500, system: SYSTEM_PROMPT, messages: messages.slice(-10) },
      { headers: { "x-api-key": process.env.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01", "Content-Type": "application/json" } }
    );
    res.json({ reply: r.data.content[0].text });
  } catch (err) {
    res.status(500).json({ reply: "Уучлаарай, түр алдаа гарлаа." });
  }
});

app.get("/webhook", (req, res) => {
  if (req.query["hub.mode"] === "subscribe" && req.query["hub.verify_token"] === process.env.VERIFY_TOKEN) {
    res.status(200).send(req.query["hub.challenge"]);
  } else { res.sendStatus(403); }
});

app.post("/webhook", async (req, res) => {
  const body = req.body;
  if (body.object !== "page") return res.sendStatus(404);
  for (const entry of body.entry) {
    for (const event of entry.messaging) {
      if (!event.message?.text) continue;
      const sid = event.sender.id;
      if (!userSessions[sid]) userSessions[sid] = [];
      userSessions[sid].push({ role: "user", content: event.message.text });
      try {
        const r = await axios.post("https://api.anthropic.com/v1/messages",
          { model: "claude-haiku-4-5-20251001", max_tokens: 500, system: SYSTEM_PROMPT, messages: userSessions[sid].slice(-10) },
          { headers: { "x-api-key": process.env.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01", "Content-Type": "application/json" } }
        );
        const reply = r.data.content[0].text;
        userSessions[sid].push({ role: "assistant", content: reply });
        await axios.post(`https://graph.facebook.com/v18.0/me/messages?access_token=${process.env.PAGE_ACCESS_TOKEN}`,
          { recipient: { id: sid }, message: { text: reply.slice(0, 1900) } }
        );
      } catch (err) { console.error(err.message); }
    }
  }
  res.sendStatus(200);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server: ${PORT}`));
