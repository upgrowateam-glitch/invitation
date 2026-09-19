const path = require('path');
const { PrismaClient } = require(path.join(__dirname, '../server/node_modules/@prisma/client'));
const prisma = new PrismaClient();

async function main() {
  const r = await prisma.recipient.findUnique({ where: { id: 1 } });
  console.log('RECIPIENT_1:', r);
}

main().finally(() => prisma.$disconnect());
