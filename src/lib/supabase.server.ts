import { createClient } from "@supabase/supabase-js";

export const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!
);

export async function uploadToStorage(bucket: string, path: string, buffer: Buffer, mimeType: string) {
  const { data, error } = await supabase.storage.from(bucket).upload(path, buffer, {
    contentType: mimeType,
    upsert: true,
  });
  if (error) throw error;
  return data;
}

export async function getPublicUrl(bucket: string, path: string) {
  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
  return data.publicUrl;
}

export async function deleteFromStorage(bucket: string, path: string) {
  const { error } = await supabase.storage.from(bucket).remove([path]);
  if (error) throw error;
}
