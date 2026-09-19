const https = require('https');
const fs = require('fs');
const path = require('path');

function downloadTTFFont() {
  // Using an older User-Agent forces Google Fonts to return TTF instead of WOFF2
  const options = {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_6_8) AppleWebKit/534.57.2 (KHTML, like Gecko) Version/5.1.7 Safari/534.57.2'
    }
  };

  https.get('https://fonts.googleapis.com/css?family=Clicker+Script', options, (res) => {
    let css = '';
    res.on('data', chunk => css += chunk);
    res.on('end', () => {
      console.log('Fetched TTF CSS:', css);
      const urlMatch = css.match(/url\((https:\/\/[^)]+)\)/);
      if (urlMatch) {
        const fontUrl = urlMatch[1];
        console.log('Downloading TTF font from:', fontUrl);

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
            console.log(`Downloaded TTF font file size: ${fontBuffer.length} bytes`);

            fontDirs.forEach(dir => {
              const targetPath = path.join(dir, 'ClickerScript-Regular.ttf');
              fs.writeFileSync(targetPath, fontBuffer);
              console.log(`Saved TTF font to: ${targetPath}`);
            });
          });
        });
      } else {
        console.error('Could not find TTF font URL in CSS');
      }
    });
  }).on('error', (err) => {
    console.error('Download font error:', err);
  });
}

downloadTTFFont();
