import Database from 'better-sqlite3';
const db = new Database('data/dashboard.db');
const turmaId = db.prepare('SELECT id FROM ebd_turmas LIMIT 1').get().id;
console.log('Turma ID:', turmaId);
const historico = db.prepare('SELECT * FROM ebd_frequencia WHERE turma_id = ?').all(turmaId);
console.log('Historico count:', historico.length);
if (historico.length > 0) {
  console.log('Sample:', historico[0]);
}
const freq = db.prepare(`SELECT ea.participant_id, p.nome,
       COALESCE((SELECT presente FROM ebd_frequencia f WHERE f.turma_id = ea.turma_id AND f.participant_id = ea.participant_id AND f.data = '2026-08-16'), 0) AS presente
  FROM ebd_alunos ea JOIN participants p ON p.id = ea.participant_id
 WHERE ea.turma_id = ?`).all(turmaId);
console.log('Freq array:', freq.slice(0,3));
