const https = require('https');
const fs = require('fs');
const path = require('path');

function downloadFont() {
  // Using Android 4.0 User-Agent forces Google Fonts API to return TTF format!
  const options = {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Linux; U; Android 4.0.2; en-us; Galaxy Nexus Build/ICL53F) AppleWebKit/534.30 (KHTML, like Gecko) Version/4.0 Mobile Safari/534.30'
    }
  };

  https.get('https://fonts.googleapis.com/css?family=Clicker+Script:400', options, (res) => {
    let body = '';
    res.on('data', c => body += c);
    res.on('end', () => {
      console.log('Android UA CSS Output:\n', body);
      const urlMatch = body.match(/url\((https:\/\/[^)]+\.ttf)\)/) || body.match(/url\((https:\/\/[^)]+)\)/);
      if (urlMatch) {
        const fontUrl = urlMatch[1];
        console.log('Downloading font file from:', fontUrl);

        https.get(fontUrl, (fontRes) => {
          const fontChunks = [];
          fontRes.on('data', c => fontChunks.push(c));
          fontRes.on('end', () => {
            const fontBuffer = Buffer.concat(fontChunks);
            console.log(`Downloaded font file size: ${fontBuffer.length} bytes`);

            const serverPath = path.join(__dirname, '../server/assets/fonts/ClickerScript-Regular.ttf');
            const clientPath = path.join(__dirname, '../client/src/assets/fonts/ClickerScript-Regular.ttf');

            fs.mkdirSync(path.dirname(serverPath), { recursive: true });
            fs.mkdirSync(path.dirname(clientPath), { recursive: true });

            fs.writeFileSync(serverPath, fontBuffer);
            fs.writeFileSync(clientPath, fontBuffer);

            console.log(`Font saved to ${serverPath} and ${clientPath}`);
          });
        });
      }
    });
  });
}

downloadFont();
