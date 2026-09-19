const https = require('https');
const fs = require('fs');
const path = require('path');

function downloadRawTTF() {
  const url = 'https://raw.githubusercontent.com/google/fonts/main/ofl/clickerscript/ClickerScript-Regular.ttf';
  
  https.get(url, (res) => {
    if (res.statusCode === 302 || res.statusCode === 301) {
      https.get(res.headers.location, (redRes) => saveFont(redRes));
    } else {
      saveFont(res);
    }
  });

  function saveFont(res) {
    const data = [];
    res.on('data', chunk => data.push(chunk));
    res.on('end', () => {
      const buffer = Buffer.concat(data);
      console.log(`Downloaded Raw TTF font size: ${buffer.length} bytes`);

      const fontDirs = [
        path.join(__dirname, '../server/assets/fonts'),
        path.join(__dirname, '../client/src/assets/fonts')
      ];

      fontDirs.forEach(dir => {
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        const targetPath = path.join(dir, 'ClickerScript-Regular.ttf');
        fs.writeFileSync(targetPath, buffer);
        console.log(`Saved Raw TTF font to: ${targetPath}`);
      });
    });
  }
}

downloadRawTTF();
