const https = require('https');
const fs = require('fs');
const path = require('path');

async function downloadRealFont() {
  // Download from official google fonts static CDN
  const url = 'https://fonts.gstatic.com/s/clickerscript/v14/raxkHiKPvt8CMH6ZWP8PdlEq71rf0Ts.ttf';
  
  https.get(url, (res) => {
    if (res.statusCode === 302 || res.statusCode === 301) {
      https.get(res.headers.location, save);
    } else {
      save(res);
    }
  });

  function save(res) {
    const data = [];
    res.on('data', c => data.push(c));
    res.on('end', () => {
      const buf = Buffer.concat(data);
      console.log('Downloaded gstatic TTF font size:', buf.length);
      
      const serverFont = path.join(__dirname, '../server/assets/fonts/ClickerScript-Regular.ttf');
      const clientFont = path.join(__dirname, '../client/src/assets/fonts/ClickerScript-Regular.ttf');

      fs.mkdirSync(path.dirname(serverFont), { recursive: true });
      fs.mkdirSync(path.dirname(clientFont), { recursive: true });

      fs.writeFileSync(serverFont, buf);
      fs.writeFileSync(clientFont, buf);

      console.log('Saved to:', serverFont);
    });
  }
}

downloadRealFont();
