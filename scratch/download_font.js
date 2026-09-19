const https = require('https');
const fs = require('fs');
const path = require('path');

function downloadFont() {
  const options = {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    }
  };

  https.get('https://fonts.googleapis.com/css2?family=Clicker+Script', options, (res) => {
    let css = '';
    res.on('data', chunk => css += chunk);
    res.on('end', () => {
      console.log('Fetched CSS:', css);
      const urlMatch = css.match(/url\((https:\/\/[^)]+)\)/);
      if (urlMatch) {
        const fontUrl = urlMatch[1];
        console.log('Downloading font from:', fontUrl);

        const fontDirs = [
          path.join(__dirname, '../server/assets/fonts'),
          path.join(__dirname, '../client/src/assets/fonts')
        ];

        fontDirs.forEach(dir => {
          if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        });

        https.get(fontUrl, (fontRes) => {
          const fontData = [];
          fontRes.on('data', chunk => fontData.push(chunk));
          fontRes.on('end', () => {
            const fontBuffer = Buffer.concat(fontData);
            console.log(`Downloaded font file size: ${fontBuffer.length} bytes`);

            fontDirs.forEach(dir => {
              const targetPath = path.join(dir, 'ClickerScript-Regular.ttf');
              fs.writeFileSync(targetPath, fontBuffer);
              console.log(`Saved font to: ${targetPath}`);
            });
          });
        });
      } else {
        console.error('Could not find font URL in CSS');
      }
    });
  }).on('error', (err) => {
    console.error('Download font error:', err);
  });
}

downloadFont();
