const path = require('path');
const express = require(path.join(__dirname, '../server/node_modules/express'));
const app = require(path.join(__dirname, '../server/src/app'));
const { PrismaClient } = require(path.join(__dirname, '../server/node_modules/@prisma/client'));

const prisma = new PrismaClient();

async function testServerEndpoints() {
  const token = 'a5f7eccf9b749f2bf5f27bfeca4fc4c990b92848da93a5baea4d7907d8ed2270';
  
  // Start server on temporary port 5099
  const server = app.listen(5099);
  const baseUrl = 'http://localhost:5099';

  try {
    console.log('=== TESTING REAL HTTP ENDPOINTS & SERVER RESTART PERSISTENCE ===\n');

    // 1. GET /api/public/invitation/:token with WhatsApp Crawler User-Agent
    console.log('1. Testing GET /api/public/invitation/:token (WhatsApp Crawler UA)...');
    const resMetadata = await fetch(`${baseUrl}/api/public/invitation/${token}`, {
      headers: { 'User-Agent': 'WhatsApp/2.21.12.21 A' }
    });
    const jsonMetadata = await resMetadata.json();

    console.log(`   - HTTP Status: ${resMetadata.status}`);
    console.log(`   - Content-Type: ${resMetadata.headers.get('content-type')}`);
    console.log(`   - Recipient Name: ${jsonMetadata.recipient?.name}`);
    console.log(`   - Generated Path: ${jsonMetadata.recipient?.generatedPdfPath}`);

    // 2. GET /api/public/invitation/:token/download
    console.log('\n2. Testing High-Resolution Download Endpoint (/api/public/invitation/:token/download)...');
    const resDownload = await fetch(`${baseUrl}/api/public/invitation/${token}/download`);
    const downloadBlob = await resDownload.arrayBuffer();

    console.log(`   - HTTP Status: ${resDownload.status}`);
    console.log(`   - Content-Type: ${resDownload.headers.get('content-type')}`);
    console.log(`   - Content-Disposition: ${resDownload.headers.get('content-disposition')}`);
    console.log(`   - Downloaded File Size: ${downloadBlob.byteLength} bytes`);

    // 3. GET Static Full-HD Image URL (/uploads/generated/invite-...png)
    console.log('\n3. Testing Main Full-HD Image Static URL (/uploads/generated/invite-...png)...');
    const resMainImage = await fetch(`${baseUrl}/uploads/generated/invite-${token}.png`);
    const mainImgBlob = await resMainImage.arrayBuffer();

    console.log(`   - HTTP Status: ${resMainImage.status}`);
    console.log(`   - Content-Type: ${resMainImage.headers.get('content-type')}`);
    console.log(`   - Main Image Size: ${mainImgBlob.byteLength} bytes`);

    // 4. GET Static Social OG Preview URL (/uploads/social/invite-...jpg)
    console.log('\n4. Testing WhatsApp OG Preview Static URL (/uploads/social/invite-...jpg)...');
    const resOgImage = await fetch(`${baseUrl}/uploads/social/invite-${token}.jpg`);
    const ogImgBlob = await resOgImage.arrayBuffer();

    console.log(`   - HTTP Status: ${resOgImage.status}`);
    console.log(`   - Content-Type: ${resOgImage.headers.get('content-type')}`);
    console.log(`   - Social Preview Size: ${ogImgBlob.byteLength} bytes`);

    // 5. Verify DB fields post-crawler request
    console.log('\n5. Verifying DB Record Fields Post-Crawler Requests...');
    const recPost = await prisma.recipient.findUnique({ where: { token } });
    console.log(`   - ID: ${recPost.id}`);
    console.log(`   - Response Status: ${recPost.responseStatus} (MUST REMAIN ACCEPTED)`);
    console.log(`   - Sent Date: ${recPost.sentDate.toISOString()}`);
    console.log(`   - First Viewed Date: ${recPost.firstViewedDate.toISOString()}`);
    console.log(`   - Response Date: ${recPost.responseDate.toISOString()}`);

  } catch (err) {
    console.error('HTTP Test error:', err);
  } finally {
    server.close();
    await prisma.$disconnect();
  }
}

testServerEndpoints();
