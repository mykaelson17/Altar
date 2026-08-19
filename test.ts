import { getFrequenciaDoDia } from "./src/lib/ebd.functions.ts";

async function run() {
  const req = {
    method: 'GET',
    data: {
      turmaId: '165212d6-9873-4de1-b70b-823b6f98113d',
      data: '2026-06-21',
      ano: 2026,
      trimestre: 2
    },
    context: { auth: { role: 'master' } }
  };
  const res = await getFrequenciaDoDia(req as any);
  console.log(res);
}

run().catch(console.error);
