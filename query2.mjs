import pkg from "better-sqlite3";
const DatabaseConstructor = pkg;

const db = new DatabaseConstructor("data/dashboard.db");
const rows = db.prepare("SELECT * FROM ebd_frequencia WHERE data = '2026-08-16'").all();
console.log("Records for 2026-08-16:");
console.log(rows);
