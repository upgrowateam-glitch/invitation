const path = require('path');
const fs = require('fs');
const sharp = require(path.join(__dirname, '../server/node_modules/sharp'));

async function testSharpBase64Font() {
  const fontPath = path.join(__dirname, '../server/assets/fonts/ClickerScript-Regular.ttf');
  const fontBuffer = fs.readFileSync(fontPath);
  const base64Font = fontBuffer.toString('base64');
  console.log('Font TTF buffer length:', fontBuffer.length);

  const width = 1080;
  const height = 1920;
  const fontSizePx = 120;

  const svg = `
    <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <style type="text/css">
          @font-face {
            font-family: "Clicker Script";
            font-style: normal;
            font-weight: 400;
            src: url("data:font/ttf;charset=utf-8;base64,${base64Font}") format("truetype");
          }
          .custom-text {
            font-family: "Clicker Script", cursive;
            font-size: ${fontSizePx}px;
            font-weight: 400;
            fill: #000000;
            text-anchor: middle;
            dominant-baseline: central;
          }
        </style>
      </defs>
      <rect width="100%" height="100%" fill="#ffffff" />
      <text x="${width / 2}" y="${height * 0.565}" class="custom-text">Asritha Test</text>
    </svg>
  `;

  const png = await sharp(Buffer.from(svg)).png().toBuffer();
  const outPath = path.join(__dirname, 'sharp_base64_test.png');
  fs.writeFileSync(outPath, png);
  console.log('Saved sharp base64 test to:', outPath);
}

testSharpBase64Font().catch(console.error);
