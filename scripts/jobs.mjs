const response = await fetch(
  `${process.env.APP_URL || "http://localhost:3000"}/api/jobs`,
  {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.CRON_SECRET}`,
      "Content-Type": "application/json",
    },
    body: "{}",
  },
);
console.log(await response.text());
if (!response.ok) process.exitCode = 1;
