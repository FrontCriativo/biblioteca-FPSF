import { DatabaseSync } from 'node:sqlite';
import { readFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const arquivoBanco = join(here, 'biblioteca.db');

mkdirSync(here, { recursive: true });

export const db = new DatabaseSync(arquivoBanco);

db.exec(readFileSync(join(here, 'schema.sql'), 'utf8'));

export function transacao(fn) {
  db.exec('BEGIN');
  try {
    const resultado = fn();
    db.exec('COMMIT');
    return resultado;
  } catch (erro) {
    db.exec('ROLLBACK');
    throw erro;
  }
}
