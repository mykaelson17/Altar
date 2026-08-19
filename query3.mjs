import pkg from "better-sqlite3";
const DatabaseConstructor = pkg;

const db = new DatabaseConstructor("data/dashboard.db");
const turmaId = '441a31ef-e7f7-4b19-add7-45a53cc7fc9c'; // using the turma id from above that has 1s
const data = '2026-08-16';
const ano = 2026;
const trimestre = 3;

const rows = db.prepare(`SELECT ea.participant_id, p.nome,
              COALESCE((SELECT presente FROM ebd_frequencia f WHERE f.turma_id = ea.turma_id AND f.participant_id = ea.participant_id AND f.data = ?), 0) AS presente
         FROM ebd_alunos ea JOIN participants p ON p.id = ea.participant_id
        WHERE ea.turma_id = ? AND ea.ano = ? AND ea.trimestre = ? ORDER BY p.nome`).all(data, turmaId, ano, trimestre);

console.log(rows);
