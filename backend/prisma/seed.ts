// Seed inicial — útil para desarrollo local.
// No corre en producción.
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // Placeholder: cuando exista auth se sembrará un user dev.
  console.warn('[seed] No hay datos seed configurados aún.');
}

main()
  .catch((err) => {
    console.error('[seed] Error:', err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
