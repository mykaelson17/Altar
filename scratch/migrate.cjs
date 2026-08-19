const { createClient } = require('@libsql/client');
const fs = require('fs');

const env = Object.fromEntries(
  fs.readFileSync('.env', 'utf8')
    .split('\n')
    .filter(Boolean)
    .map(l => l.split('='))
);

const client = createClient({ 
  url: env.TURSO_DATABASE_URL.trim().replace(/^"|"$/g, ''), 
  authToken: env.TURSO_AUTH_TOKEN.trim().replace(/^"|"$/g, '') 
});

async function run() { 
  try { 
    await client.execute('ALTER TABLE participants ADD COLUMN cep TEXT');
    await client.execute('ALTER TABLE participants ADD COLUMN endereco TEXT');
    await client.execute('ALTER TABLE participants ADD COLUMN numero TEXT');
    await client.execute('ALTER TABLE participants ADD COLUMN bairro TEXT');
    await client.execute('ALTER TABLE participants ADD COLUMN cidade TEXT');
    await client.execute('ALTER TABLE participants ADD COLUMN estado TEXT');
    console.log('Columns added!'); 
  } catch(e) { 
    console.error(e.message); 
  } 
} 

run();
