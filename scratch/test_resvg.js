const path = require('path');
const fs = require('fs');
const { Resvg } = require(path.join(__dirname, '../server/node_modules/@resvg/resvg-js'));

async function testResvgFont() {
  const fontPath = path.join(__dirname, '../server/assets/fonts/ClickerScript-Regular.ttf');
  if (!fs.existsSync(fontPath)) {
    throw new Error(`Font file missing at ${fontPath}`);
  }

  const fontBuffer = fs.readFileSync(fontPath);
  console.log(`Loaded font buffer: ${fontBuffer.length} bytes`);

  const width = 1080;
  const height = 1920;
  const fontSizePx = 110;
  const fontColour = '#000000';
  const textName = 'Asritha Test';

  const svg = `
    <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <rect width="100%" height="100%" fill="#ffffff" />
      <text 
        x="${width / 2}" 
        y="${height * 0.565}" 
        font-family="Clicker Script" 
        font-size="${fontSizePx}px" 
        font-weight="400" 
        fill="${fontColour}" 
        text-anchor="middle" 
        dominant-baseline="central"
      >${textName}</text>
    </svg>
  `;

  const resvg = new Resvg(svg, {
    font: {
      fontBuffers: [fontBuffer],
      defaultFontFamily: 'Clicker Script'
    }
  });

  const pngData = resvg.render().asPng();
  const outputPath = path.join(__dirname, 'resvg_test_render.png');
  fs.writeFileSync(outputPath, pngData);
  console.log(`Rendered PNG with Resvg: ${outputPath} (${pngData.length} bytes)`);
}

testResvgFont().catch(console.error);
