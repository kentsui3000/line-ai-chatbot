    const admin = require('firebase-admin');
    const fs = require('fs');
    const xml2js = require('xml2js');

    // === 設定部分 (請修改以下兩個變數) ===

    // 請將你的 Firestore 管理員金鑰檔案名稱貼到這裡
    const serviceAccount = require('./quiet-dryad-472401-n9-afd234d7d06d.json'); 

    // 請將從 WordPress 匯出的 XML 檔案名稱貼到這裡
    const wordpressXmlFile = '-dr.wordpress.2025-09-17.000.xml'; 

    // === 初始化 Firebase Admin SDK ===
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    });

    const db = admin.firestore();
    const parser = new xml2js.Parser();

    async function importPosts() {
      console.log('--- 開始匯入 WordPress 文章到 Firestore ---');

      try {
        // 1. 讀取並解析 XML 檔案
        const xmlData = fs.readFileSync(wordpressXmlFile, 'utf8');
        const result = await parser.parseStringPromise(xmlData);

        const posts = result.rss.channel[0].item;
        let successCount = 0;
        let failCount = 0;

        // 2. 迭代每一篇文章並上傳到 Firestore
        for (const post of posts) {
          if (post['wp:post_type'][0] === 'post' && post['wp:status'][0] === 'publish') {
            const title = post.title[0];
            const content = post['content:encoded'][0];
            const postId = post['wp:post_id'][0];

            try {
              const docRef = db.collection('articles').doc(); // 使用自動生成的 ID
              await docRef.set({
                title: title,
                content: content,
                // 如果你有標籤，也可以一併匯入
                tags: [], 
                source: 'wordpress',
                postId: postId,
                createdAt: admin.firestore.FieldValue.serverTimestamp() // 紀錄匯入時間
              });
              console.log(`成功匯入文章: "${title}"`);
              successCount++;
            } catch (error) {
              console.error(`匯入文章 "${title}" 失敗:`, error);
              failCount++;
            }
          }
        }

        console.log('--- 匯入完成 ---');
        console.log(`總計匯入成功: ${successCount} 篇`);
        console.log(`總計匯入失敗: ${failCount} 篇`);

      } catch (error) {
        console.error('執行腳本時發生錯誤:', error);
      }
    }

    // 執行匯入功能
    importPosts();
    
