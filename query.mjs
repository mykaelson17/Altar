import pkg from "better-sqlite3";
const DatabaseConstructor = pkg;

const db = new DatabaseConstructor("data/dashboard.db");
const rows = db.prepare("SELECT * FROM ebd_frequencia LIMIT 20").all();
console.log(rows);
