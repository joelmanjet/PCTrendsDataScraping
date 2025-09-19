# Discord Jawa “Sold Alerts” Scraper (Puppeteer)

Scrapes a **single Discord channel you own** that posts “sold” alerts for PCs.  
Opens Discord in a visible browser (you log in once), scrolls the channel, parses each alert, and writes a CSV.

**Captured fields**
- `date_sold` – Discord message timestamp  
- `price` – first `$…` in the alert  
- `cpu`, `gpu` – parsed from text (regex)  
- `title` – cleaned alert title  
- `seller` – if present (e.g., “(from NAME)”)  
- `url` – Jawa product link (if present)  
- `message_id` – Discord message id  

---
##Disclaimer!!

- Educational use only. This script is provided “as is,” without warranties.
- You are solely responsible for how you use it. Any misuse, disruption, or violation of server rules, Discord’s Terms, or law is your responsibility.
- The author(s) are not liable for any damages, account actions, or consequences arising from use of this code.

---

## Quick Start

```bash
npm i puppeteer@22
node discord_puppeteer_scrape.js

