document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("buy").addEventListener("click", () => trade("buy"));
  document.querySelectorAll(".sell").forEach(btn => {
    btn.addEventListener("click", () => {
      const percent = parseInt(btn.dataset.percent);
      trade("sell", percent);
    });
  });
  document.getElementById("reset-token").addEventListener("click", resetTrades);
  document.getElementById("reset-all").addEventListener("click", resetAllTrades);

  updateHoldings();
});

async function trade(type, percent = 100) {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const url = tab.url;
  const title = await new Promise((resolve, reject) => {
        chrome.tabs.sendMessage(tab.id, { type: "GET_TITLE" }, (response) => {
            if (chrome.runtime.lastError || !response) {
                console.log(chrome.runtime.lastError)
                reject("Could not get title");
            } else {
                resolve(response.title);
            }
        });
  });


  const tokenId = new URL(url).searchParams.get('address');
  const price = parseFloat(title[0].result.split(' | Bullx')[0].split('$')[1].match(/[\d\.]+/)[0]);
  const timestamp = Date.now();

  let { trades = {} } = await chrome.storage.local.get("trades");
  if (!trades[tokenId]) trades[tokenId] = [];

  let amount = 1;

  if (type === "sell") {
    const tokenTrades = trades[tokenId];
    const buys = tokenTrades.filter(t => t.type === "buy").reduce((sum, t) => sum + t.amount, 0);
    const sells = tokenTrades.filter(t => t.type === "sell").reduce((sum, t) => sum + t.amount, 0);
    const held = buys - sells;
    amount = parseFloat((held * (percent / 100)).toFixed(2));
    if (amount <= 0) return alert("Nothing to sell.");
  }

  trades[tokenId].push({ type, price, amount, timestamp });
  await chrome.storage.local.set({ trades });

  updateHoldings();
}

async function updateHoldings() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const url = tab.url;
  const tokenId = new URL(url).searchParams.get('address');
  let { trades = {} } = await chrome.storage.local.get("trades");

  const tokenTrades = trades[tokenId] || [];
  const buys = tokenTrades.filter(t => t.type === "buy").reduce((sum, t) => sum + t.amount, 0);
  const sells = tokenTrades.filter(t => t.type === "sell").reduce((sum, t) => sum + t.amount, 0);
  const holding = (buys - sells).toFixed(2);

  document.getElementById("holdings").innerText = `You hold: ${holding} units`;
}

async function resetTrades() {
  if (!confirm("Are you sure you want to reset all trades for this token?")) return;

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const url = tab.url;
  const tokenId = new URL(url).searchParams.get('address');

  let { trades = {} } = await chrome.storage.local.get("trades");
  delete trades[tokenId];

  await chrome.storage.local.set({ trades });
  updateHoldings();
}

async function resetAllTrades() {
  if (!confirm("Are you sure you want to reset ALL trades for ALL tokens? This cannot be undone.")) return;

  await chrome.storage.local.remove("trades");
  updateHoldings();
}

updateHoldings();
