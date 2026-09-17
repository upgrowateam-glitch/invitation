const { PrismaClient } = require('@prisma/client'); const prisma = new PrismaClient(); prisma.template.findMany().then(console.log).finally(() => prisma.$disconnect());
