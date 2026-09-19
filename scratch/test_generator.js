const path = require('path');
const { generateInvitationAssets } = require(path.join(__dirname, '../server/src/utils/imageGenerator'));

async function testGen() {
  try {
    console.log('Testing image generator...');
    const result = await generateInvitationAssets({
      recipientName: 'Test Recipient Name',
      templateId: 1,
      token: 'testtoken123456789'
    });

    console.log('Generated result:', result);
  } catch (err) {
    console.error('Test generator error:', err);
  }
}

testGen();
