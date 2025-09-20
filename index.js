const express = require('express');
const axios = require('axios');
const admin = require('firebase-admin');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const app = express();
app.use(express.json());

// === 你的 LINE 頻道金鑰 (請務必在此貼上你的金鑰) ===
// 你可以在 LINE Developers 後台的 Basic settings 頁面找到 Channel secret
const CHANNEL_SECRET = 'ffda16a6ec116b44c3f0e4a24b3cb5d4';
// 你可以在 LINE Developers 後台的 Messaging API 頁面找到 Channel access token
const CHANNEL_ACCESS_TOKEN = 'm5uX0EA9EuSxXULsYHDaql4iynu+Uub+GH5qsPsXSBJxgHkdDWGzAEMHyIhyHMHIcMuV52t2vLdgrmxOl7/Tfb6MKRbWcR2zanyKMNR/QimCq2u6M5Z8Q2G4cNUiC9jn9WEnFZ9ftWKDVLAtidL8ogdB04t89/1O/w1cDnyilFU=';

// === 你的 Google Cloud / Firebase 設定 ===
// 請從 Vercel 的環境變數中讀取你的金鑰
const serviceAccount = JSON.parse(process.env.FIREBASE_ADMIN_KEY);

// 請在 Vercel 的環境變數中設定你的 Gemini API Key
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

// === 初始化 Firebase Admin SDK ===
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

// 初始化 Google Gemini API
const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-1.5-pro" });

// === 處理 LINE 的 Webhook 請求 ===

// 為了讓 LINE 的驗證通過，回傳 200 OK
// 這個路由用來回應 LINE 的測試請求
app.get('/', (req, res) => {
  res.status(200).send('OK');
});

// 主要的 Webhook 處理路由
app.post('/webhook', async (req, res) => {
  const events = req.body.events;
  for (const event of events) {
    if (event.type === 'message' && event.message.type === 'text') {
      const userMessage = event.message.text;

      console.log(`收到訊息: ${userMessage}`);

      // 檢查訊息是否包含掛號關鍵字
      if (userMessage.includes('掛號')) {
        const replyText = `您好，這是我們的掛號網頁：\nhttp://08143.vision.com.tw/Register`;
        await replyToLine(event.replyToken, replyText);
        return;
      }

      // 取得文章資料庫
      const articles = await getArticles();

      // 使用 AI 模型來生成回覆
      try {
        const prompt = `你是一位專業的徐嘉賢醫師助理，請根據以下文章內容和病患的問題，提供專業、友善且精簡的回答。如果問題與文章內容無關，請禮貌地拒絕回答，並建議病患前往掛號。請務必使用繁體中文回答。

        文章資料庫:
        ${JSON.stringify(articles)}

        病患問題:
        ${userMessage}

        請注意：
        1. 你的回答必須基於提供的文章資料。
        2. 如果問題無法從文章中回答，請禮貌地建議病患掛號。
        3. 回覆應簡潔、友善，像是一位專業的醫師助理。
        4. 如果問題是關於疫苗、發燒，但無法從文章中找到，請特別溫馨提醒病患可以掛號由醫師親自評估。
        `;

        const result = await model.generateContent(prompt);
        const replyText = result.response.text;
        await replyToLine(event.replyToken, replyText);

      } catch (error) {
        console.error('AI 或 Firebase 請求失敗:', error);
        // 如果 AI 請求失敗，提供一個備用回覆
        await replyToLine(event.replyToken, '您好，AI 助理目前無法回應您的問題，建議您直接掛號由醫師親自評估喔！');
      }
    }
  }

  res.status(200).send('OK');
});

// 從 Firestore 讀取文章
async function getArticles() {
  const articlesRef = db.collection('articles');
  const snapshot = await articlesRef.get();
  const articles = [];
  snapshot.forEach(doc => {
    articles.push(doc.data());
  });
  return articles;
}

// 回覆給 LINE 的函數
async function replyToLine(replyToken, replyText) {
  const message = {
    type: 'text',
    text: replyText
  };

  await axios.post('https://api.line.me/v2/bot/message/reply', {
    replyToken: replyToken,
    messages: [message]
  }, {
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${CHANNEL_ACCESS_TOKEN}`
    }
  });
}

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`伺服器正在聆聽 Port ${port}`);
});
