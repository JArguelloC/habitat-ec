// @ts-ignore
import pg from 'pg';
import fs from 'node:fs';
import path from 'node:path';
import dns from 'node:dns';
import { fileURLToPath } from 'node:url';

// Priorizar resolución IPv4 para prevenir AggregateError [ETIMEDOUT] en Windows con Neon
dns.setDefaultResultOrder('ipv4first');

// Cargar variables de entorno desde backend/.env
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const envPath = path.resolve(__dirname, '../../.env');

if (fs.existsSync(envPath)) {
  if (typeof process.loadEnvFile === 'function') {
    process.loadEnvFile(envPath);
  } else {
    const envContent = fs.readFileSync(envPath, 'utf8');
    for (const line of envContent.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eqIdx = trimmed.indexOf('=');
      if (eqIdx !== -1) {
        const key = trimmed.slice(0, eqIdx).trim();
        const value = trimmed.slice(eqIdx + 1).trim();
        if (!process.env[key]) {
          process.env[key] = value;
        }
      }
    }
  }
}

const { Pool } = pg;

const host = process.env.DB_HOST;
const port = Number(process.env.DB_PORT || 5432);
const user = process.env.DB_USER;
const password = process.env.DB_PASSWORD;
const database = process.env.DB_NAME;
const connectionString = process.env.DATABASE_URL;

console.log('--- Diagnóstico de Conexión a Neon Serverless PostgreSQL ---');
console.log(`📍 Host objetivo: ${host || '(desde DATABASE_URL)'}`);
console.log(`🔌 Puerto: ${port}`);
console.log(`👤 Usuario: ${user || 'N/A'}`);
console.log(`🗄️  Base de datos: ${database || 'N/A'}`);
console.log(`🔒 SSL: rejectUnauthorized = false (Compatible con Neon CA)`);

const poolConfig: pg.PoolConfig = host
  ? {
      host,
      port,
      user,
      password,
      database,
      ssl: {
        rejectUnauthorized: false,
      },
      connectionTimeoutMillis: 15000,
      query_timeout: 15000,
      statement_timeout: 15000,
      keepAlive: true,
    }
  : {
      connectionString,
      ssl: {
        rejectUnauthorized: false,
      },
      connectionTimeoutMillis: 15000,
      query_timeout: 15000,
      statement_timeout: 15000,
      keepAlive: true,
    };

const pool = new Pool(poolConfig);

async function testConnection() {
  console.log('\n⏳ Intentando establecer handshake con Neon...');
  const startTime = Date.now();
  try {
    const client = await pool.connect();
    const duration = Date.now() - startTime;
    console.log(`✅ ¡Conexión establecida con éxito en ${duration}ms!`);

    const result = await client.query(
      'SELECT NOW() as server_time, current_user as usuario_activo, current_database() as base_datos;',
    );
    console.log('\n📊 Datos de sesión verificados:');
    console.table(result.rows);

    client.release();
    await pool.end();
    console.log('\n🏁 Pool cerrado correctamente. Diagnóstico superado.');
    process.exit(0);
  } catch (error: any) {
    const duration = Date.now() - startTime;
    console.error(`\n❌ Error de conexión tras ${duration}ms: ${error.message || error}`);
    if (error.code) console.error(`Código de error: ${error.code}`);

    if (error.message?.includes('timeout') || error.code === 'ETIMEDOUT') {
      console.warn('\n⚠️  POSIBLE CAUSA DEL TIMEOUT:');
      console.warn('1. La red actual (ej. Wi-Fi universitaria/corporativa) suele bloquear el puerto 5432 saliente.');
      console.warn('2. Prueba conectarte a datos móviles (hotspot del teléfono) o activar una VPN.');
      console.warn('3. Verifica que el endpoint de Neon esté activo (sin estar en sleep profundo).');
    }

    await pool.end();
    process.exit(1);
  }
}

void testConnection();
