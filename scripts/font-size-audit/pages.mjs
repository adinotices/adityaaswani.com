// Page list for the font-size audit of adityaaswani.com. Run: see README.md.
const O = "https://adityaaswani.com";
const dark = async (page) => {
  await page.evaluate(() => { try { localStorage.setItem("theme", "dark"); } catch {} document.documentElement.setAttribute("data-theme", "dark"); });
};
const openMenu = async (page, { width }) => {
  if (width > 820) return;
  await page.click(".menu-toggle");
  await new Promise((r) => setTimeout(r, 600));
};
const base = { dark };
export default {
  product: "adityaaswani.com",
  // Set AUDIT_LOCAL=/abs/dist to audit a local build instead of the live site.
  ...(process.env.AUDIT_LOCAL ? { local: { origin: O, dir: process.env.AUDIT_LOCAL, skip: /^\/(cdn-cgi)\// } } : {}),
  pages: [
    { name: "home", url: `${O}/`, ...base },            // includes the Building and Writing sections (posts link out to Substack)
    { name: "home-menu", url: `${O}/`, ...base, prepare: openMenu }, // hamburger open with the Appearance row (phone); desktop nav is inline
    { name: "meditation", url: `${O}/learn-meditation/`, ...base },
    { name: "links", url: `${O}/links/`, ...base },
    { name: "contact", url: `${O}/contact/`, ...base },
    { name: "support", url: `${O}/support/`, ...base },
    { name: "support-other", url: `${O}/support/`, ...base, prepare: async (page) => {
        // Pick one-time and "Other", enter an invalid amount to show the error text. Stops before any payment.
        await page.evaluate(() => { document.querySelector('input[type=radio][value=once]')?.click(); });
        await new Promise((r) => setTimeout(r, 300));
        await page.evaluate(() => { const o = [...document.querySelectorAll("#ladder-once input[type=radio]")].pop(); o?.click(); });
        await new Promise((r) => setTimeout(r, 300));
        const i = await page.$("#other-amount");
        if (i) { await i.type("5000"); await i.evaluate((e) => e.blur()); }
        await new Promise((r) => setTimeout(r, 300));
      } },
    { name: "support-thanks", url: `${O}/support/thanks/`, ...base },
    { name: "404", url: `${O}/404.html`, ...base },
  ],
};
