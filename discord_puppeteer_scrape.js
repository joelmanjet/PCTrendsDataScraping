// Function: this script scapes a single Discord channel (that you can access) for in this case Jawa "sold" alerts without being invasive to the server itself.
// Manual login in the opened browser. No token needed.

const fs = require("fs");
const path = require("path");
const puppeteer = require("puppeteer");

// 1) Right-click your sales channel in Discord → Copy Link (looks like
//    https://discord.com/channels/<guildId>/<channelId>) and paste below.
const CHANNEL_URL = "https://discord.com/channels/YOUR_GUILD/YOUR_CHANNEL";

// 2) How far back to scroll
const MAX_SCROLLS = 60;        // ~60 * 100 msgs if available
const SCROLL_PAUSE_MS = [800, 1400];

const CSV = path.resolve("discord_sold_pcs.csv");

// Simple helpers
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const rand  = (a,b)=> Math.floor(a + Math.random()*(b-a));
const q = (s) => `"${(`${s||""}`).replace(/"/g,'""')}"`;

function ensureCsvHeader() {
  if (!fs.existsSync(CSV)) {
    fs.writeFileSync(CSV, "date_sold,price,cpu,gpu,title,seller,url,message_id\n");
  }
}

// ---- DOM extractors (run inside the page) ----
function parseMessagesFromDOM() {
  const cpuRe = /(Ryzen ?\d{3,5}X?|i[3579]-\d{3,5}[KF]?)/i;
  const gpuRe = /(RTX ?\d{3,4}(?: ?TI| ?SUPER| ?S)?|GTX ?\d{3,4}(?: ?TI)?|RX ?\d{3,4}(?: ?XT| ?GRE)?)/i;
  const money = /\$[0-9][0-9,]*(?:\.[0-9]{2})?/;
  const SOLD_HINT = /(was just sold|sold)/i;

  // Main message list container
  const list =
    document.querySelector('ol[data-list-id="chat-messages"]') ||
    document.querySelector('[data-list-id="chat-messages"]') ||
    document.querySelector('ol[aria-label*="messages"], ol[role="list"]');

  if (!list) return { items: [], done: false };

  const items = [];
  const lis = Array.from(list.querySelectorAll("li"));

  for (const li of lis) {
    const text = (li.innerText || "").trim();
    if (!SOLD_HINT.test(text)) continue; // only sales alerts

    // discord message id lives on li's data-list-item-id or descendants
    let mid = li.getAttribute("data-list-item-id") || "";
    if (!mid) {
      const any = li.querySelector("[data-list-item-id]");
      if (any) mid = any.getAttribute("data-list-item-id");
    }

    // Try to get timestamp from <time datetime="...">
    const dt =
      li.querySelector("time")?.getAttribute("datetime") ||
      li.querySelector("time")?.dateTime ||
      "";

    // Prefer embed title anchor that has price (" — $...") or a jawa link
    let title = "";
    let url = "";
    let price = "";

    for (const a of li.querySelectorAll("a")) {
      const t = (a.textContent || "").trim();
      if (/jawa\.gg\/product/.test(a.href)) url = a.href;
      if (money.test(t)) {
        title = t.replace(/\s*[–—-]\s*\$[0-9,\.]+.*/, "").trim();
        price = t.match(money)?.[0]?.replace(/\$|,/g, "") || "";
        if (!url) url = a.href || url;
      }
    }
    if (!price) {
      const m = text.match(money);
      if (m) price = m[0].replace(/\$|,/g, "");
    }
    if (!title) {
      const firstLine = (text.split("\n")[1] || text.split("\n")[0] || "").trim();
      title = firstLine.replace(/\s*[–—-]\s*\$[0-9,\.]+.*/, "").trim();
    }

    // Seller "(from NAME)"
    const seller =
      (text.match(/\(from ([^)]+)\)/i)?.[1] || "").trim();

    // CPU/GPU from combined text
    const cpu = (text.match(cpuRe)?.[0] || "").toUpperCase();
    const gpu = (text.match(gpuRe)?.[0] || "").toUpperCase();

    items.push({
      message_id: mid || "",
      date_sold: dt || new Date().toISOString(),
      price: price || "",
      title: title || "",
      seller: seller || "",
      cpu,
      gpu,
      url: url || "",
    });
  }

  // determine if top is reached (Discord shows "Welcome to the beginning...")
  const topBadge = list.parentElement?.querySelector('[class*="jumpToPresentBar"]')?.textContent || "";
  const done = /beginning of/.test((topBadge || "").toLowerCase());
  return { items, done };
}

async function run() {
  ensureCsvHeader();

  const browser = await puppeteer.launch({
    headless: false,
    args: ["--no-sandbox", "--disable-dev-shm-usage"],
    defaultViewport: { width: 1400, height: 900 },
  });
  const page = await browser.newPage();
  await page.setUserAgent(
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36"
  );

  // Open channel; you log in manually if needed
  await page.goto(CHANNEL_URL, { waitUntil: "domcontentloaded", timeout: 0 });

  // Wait until message list appears (after login)
  await page.waitForSelector('ol[data-list-id="chat-messages"], [data-list-id="chat-messages"]', { timeout: 0 });
  console.log("Channel loaded. Starting scroll & parse…");

  // Scroll up gradually and parse each pass
  const seen = new Set();
  for (let i = 0; i < MAX_SCROLLS; i++) {
    const res = await page.evaluate(parseMessagesFromDOM);
    for (const it of res.items) {
      const key = it.message_id || `${it.title}|${it.price}|${it.date_sold}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const row = [
        it.date_sold,
        it.price,
        it.cpu,
        it.gpu,
        q(it.title),
        q(it.seller),
        it.url,
        it.message_id,
      ].join(",") + "\n";
      fs.appendFileSync(CSV, row);
    }

    // Scroll up the messages container
    await page.evaluate(() => {
      const list = document.querySelector('ol[data-list-id="chat-messages"]') ||
                   document.querySelector('[data-list-id="chat-messages"]');
      if (list) {
        const scroller = list.parentElement?.parentElement || list;
        scroller.scrollTop = 0; // jump to top of loaded batch
      }
    });

    if (res.done) break;
    await sleep(rand(...SCROLL_PAUSE_MS));
  }

  console.log("Saved ->", CSV);
  console.log("Done.");
  await browser.close();
}

run().catch(e => { console.error(e); process.exit(1); });
