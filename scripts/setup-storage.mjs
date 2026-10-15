const url = process.env.SUPABASE_URL,
  key = process.env.SUPABASE_SERVICE_ROLE_KEY,
  bucket = process.env.SUPABASE_STORAGE_BUCKET || "toga-photos";
if (!url || !key)
  throw new Error("Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.");
const headers = {
  Authorization: `Bearer ${key}`,
  apikey: key,
  "Content-Type": "application/json",
};
let response = await fetch(`${url}/storage/v1/bucket/${bucket}`, { headers });
const initial = await response.json();
if (
  response.status === 404 ||
  (!response.ok &&
    String(initial.statusCode) === "404" &&
    initial.message === "Bucket not found")
) {
  response = await fetch(`${url}/storage/v1/bucket`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      id: bucket,
      name: bucket,
      public: false,
      file_size_limit: 4194304,
      allowed_mime_types: ["image/webp"],
    }),
  });
  if (!response.ok)
    throw new Error(`Bucket creation failed (${response.status}).`);
} else if (!response.ok)
  throw new Error(`Bucket check failed (${response.status}).`);
response = await fetch(`${url}/storage/v1/bucket/${bucket}`, { headers });
const data = await response.json();
if (data.public)
  throw new Error("The bucket must be private. Do not use a public bucket.");
console.log("Private Supabase photo bucket verified.");
