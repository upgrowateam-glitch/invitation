const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const path = require('path');

async function fix() {
  const fullPath = path.resolve(__dirname, '../client/public/bni-template.pdf');
  await prisma.pdfTemplate.updateMany({
    where: { name: 'BNI Invitation Card' },
    data: { filePath: fullPath }
  });
  console.log('Fixed path to:', fullPath);
}
fix().catch(console.error).finally(() => prisma.$disconnect());
