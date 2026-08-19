// Gera o payload "Copia e Cola" do PIX (padrão EMV QR Code do Banco
// Central) — é um formato aberto e documentado publicamente, não precisa
// de nenhuma API/gateway paga pra gerar. O que a gente ganha com isso: um
// código de referência (txid) embutido no próprio QR, que é o que permite
// ligar o pagamento de volta a um membro específico depois.
//
// Referência: Manual de Padrões para Iniciação do PIX (Banco Central do Brasil).

function semAcento(s: string): string {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^\x20-\x7E]/g, "");
}

function tlv(id: string, value: string): string {
  const len = String(value.length).padStart(2, "0");
  return `${id}${len}${value}`;
}

function crc16(payload: string): string {
  let crc = 0xffff;
  for (let i = 0; i < payload.length; i++) {
    crc ^= payload.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) {
      crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}

export type PixPayloadInput = {
  chave: string;       // chave PIX de recebimento da igreja (CPF/CNPJ/e-mail/telefone/aleatória)
  nomeRecebedor: string; // nome da igreja/entidade — máx. 25 caracteres, sem acento
  cidade: string;        // cidade do recebedor — máx. 15 caracteres, sem acento
  valor?: number;        // opcional — se não vier, o app do pagador pergunta o valor
  txid: string;          // referência única (até 25 caracteres alfanuméricos) — é o que liga ao membro
  descricao?: string;    // opcional, aparece no app de quem paga
};

export function buildPixPayload(input: PixPayloadInput): string {
  const nome = semAcento(input.nomeRecebedor).slice(0, 25) || "IGREJA";
  const cidade = semAcento(input.cidade).slice(0, 15) || "BRASIL";
  const txid = input.txid.replace(/[^A-Za-z0-9]/g, "").slice(0, 25) || "***";

  const gui = tlv("00", "br.gov.bcb.pix");
  const chaveField = tlv("01", input.chave);
  const descField = input.descricao ? tlv("02", semAcento(input.descricao).slice(0, 40)) : "";
  const merchantAccountInfo = tlv("26", gui + chaveField + descField);

  const payloadFormat = tlv("00", "01");
  const mcc = tlv("52", "0000");
  const currency = tlv("53", "986"); // BRL
  const valorField = input.valor ? tlv("54", input.valor.toFixed(2)) : "";
  const country = tlv("58", "BR");
  const nomeField = tlv("59", nome);
  const cidadeField = tlv("60", cidade);
  const additionalData = tlv("62", tlv("05", txid));

  const semCrc =
    payloadFormat + merchantAccountInfo + mcc + currency + valorField + country + nomeField + cidadeField + additionalData + "6304";

  return semCrc + crc16(semCrc);
}

// Gera um txid curto, único o bastante pra não colidir na prática, só com
// letras maiúsculas e números (exigência do padrão PIX pro campo txid).
export function generateTxid(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let out = "";
  for (let i = 0; i < 16; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}
