const path = require('path');
const fs = require('fs');
const { Resvg } = require(path.join(__dirname, '../server/node_modules/@resvg/resvg-js'));

async function testFontNames() {
  const fontPath = path.join(__dirname, '../server/assets/fonts/ClickerScript-Regular.ttf');
  const fontBuffer = fs.readFileSync(fontPath);

  const base64Font = fontBuffer.toString('base64');

  const namesToTest = [
    'Clicker Script',
    'ClickerScript-Regular',
    'ClickerScript',
    'Clicker Script Regular'
  ];

  for (const fontName of namesToTest) {
    const svg = `
      <svg width="1080" height="400" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <style>
            @font-face {
              font-family: "${fontName}";
              src: url("data:font/ttf;charset=utf-8;base64,${base64Font}") format("truetype");
            }
          </style>
        </defs>
        <rect width="100%" height="100%" fill="#ffffff" />
        <text 
          x="540" 
          y="200" 
          font-family="${fontName}" 
          font-size="80px" 
          fill="#000000" 
          text-anchor="middle" 
          dominant-baseline="central"
        >Asritha Test - ${fontName}</text>
      </svg>
    `;

    const resvg = new Resvg(svg, {
      font: {
        fontBuffers: [fontBuffer],
        defaultFontFamily: fontName,
        loadSystemFonts: false
      }
    });

    const png = resvg.render().asPng();
    const outName = `test_${fontName.replace(/\s+/g, '_')}.png`;
    fs.writeFileSync(path.join(__dirname, outName), png);
    console.log(`Saved ${outName}`);
  }
}

testFontNames().catch(console.error);
