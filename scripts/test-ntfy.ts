const topic = process.env.NTFY_TOPIC;
if (!topic) {
  console.error("Missing NTFY_TOPIC env var.");
  process.exit(1);
}

const res = await fetch(`https://ntfy.sh/${encodeURIComponent(topic)}`, {
  method: "POST",
  headers: {
    "Content-Type": "text/plain; charset=utf-8",
    Title: "sylndr-alert: test notification",
    Tags: "white_check_mark,car",
    Priority: "3",
  },
  body: "Test notification from sylndr-alert. The ntfy pipeline is working. New-listing pushes will arrive here when Sylndr publishes matching cars.",
});

if (!res.ok) {
  console.error(`ntfy error ${res.status} ${res.statusText}`);
  process.exit(1);
}
console.log(`Test ntfy sent to topic ${topic}`);
