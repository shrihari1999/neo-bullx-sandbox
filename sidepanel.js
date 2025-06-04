document.addEventListener("DOMContentLoaded", () => {
  document.querySelectorAll(".btn-buy").forEach(btn => {
    btn.addEventListener("click", () => {
      const amount = parseInt(btn.dataset.amount);
      buyToken(amount)
    });
  });
  document.querySelectorAll(".btn-sell").forEach(btn => {
    btn.addEventListener("click", () => {
      const percent = parseFloat(btn.dataset.percentage);
      sellToken(percent)
    });     
  });
  document.getElementById("reset").addEventListener("click", resetState);
});

// Trading state - stored in Chrome storage for persistence
const originalState = {
    cashBalance: 100.00,
    tokenHoldings: 0,
    totalCost: 0,
    realizedPnl: 0,
    currentMktCap: '0',
    currentPrice: 0,
    lastPrice: 0,
    initialBalance: 100.00,
    tokenName: 'UNKNOWN',
    tokenId: null,
    isConnected: false,
    lastUpdateTime: 0
}
let state = JSON.parse(JSON.stringify(originalState));

// Load state from Chrome storage
async function loadState() {
    try {
        const result = await chrome.storage.local.get(['tradingState']);
        if (result.tradingState) {
            state = { ...state, ...result.tradingState };
        }
    } catch (error) {
        console.error('Error loading state:', error);
    }
}

// Save state to Chrome storage
async function saveState() {
    try {
        await chrome.storage.local.set({ tradingState: state });
    } catch (error) {
        console.error('Error saving state:', error);
    }
}

async function resetState(){
  state = JSON.parse(JSON.stringify(originalState));
  await saveState();
  showNotification('Reset complete', 'success')
  updateDisplay();
  return true
}

// Request current price from content script
async function requestCurrentPrice() {
    try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        const response = await chrome.tabs.sendMessage(tab.id, { action: 'getCurrentPrice' });
        
        if (response && response.price !== null) {
            
            // If token changed, reset position but keep cash
            if (state.tokenId && response.id && state.tokenId !== response.id) {
                const currentValue = state.tokenHoldings * state.currentPrice;
                state.cashBalance += currentValue;
                state.tokenHoldings = 0;
                state.totalCost = 0;
                state.realizedPnl = 0;
                await saveState();
                showNotification(`Switched to new token: ${response.name}`, 'success');
            }
            
            state.lastPrice = state.currentPrice || response.price;
            state.currentPrice = response.price;
            state.currentMktCap = response.mktCap;
            state.tokenName = response.name || 'UNKNOWN';
            state.tokenId = response.id;
            state.isConnected = true;
            state.lastUpdateTime = Date.now();
            
            updateDisplay();
            return true;
        }
    } catch (error) {
        console.error('Error requesting price:', error);
    }
    
    state.isConnected = false;
    updateDisplay();
    return false;
}

// Buy token
async function buyToken(amount) {
    if (!state.isConnected || state.currentPrice <= 0) {
        showNotification('No price data available!', 'error');
        return;
    }
    
    if (state.cashBalance >= amount) {
        const tokensToAdd = amount / state.currentPrice;
        state.totalCost += amount;
        state.tokenHoldings += tokensToAdd;
        state.cashBalance -= amount;
        
        await saveState();
        updateDisplay();
        showNotification(`Bought ${tokensToAdd.toFixed(4)} tokens for $${amount.toFixed(2)}`, 'success');
    } else {
        showNotification('Insufficient cash balance!', 'error');
    }
}

// Sell token
async function sellToken(percentage) {
    if (!state.isConnected || state.currentPrice <= 0) {
        showNotification('No price data available!', 'error');
        return;
    }
    
    if (state.tokenHoldings > 0) {
        const tokensToSell = state.tokenHoldings * percentage;
        const saleValue = tokensToSell * state.currentPrice;
        const avgBuyPrice = state.totalCost / state.tokenHoldings;
        const realizedGain = (state.currentPrice - avgBuyPrice) * tokensToSell;
        
        state.tokenHoldings -= tokensToSell;
        state.totalCost -= (state.totalCost * percentage);
        state.cashBalance += saleValue;
        state.realizedPnl += realizedGain;
        
        await saveState();
        updateDisplay();
        showNotification(`Sold ${tokensToSell.toFixed(4)} tokens for $${saleValue.toFixed(2)}`, 'success');
    } else {
        showNotification('No tokens to sell!', 'error');
    }
}

// Calculate unrealized P&L
function calculateUnrealizedPnl() {
    if (state.tokenHoldings === 0 || state.currentPrice <= 0) return 0;
    const currentValue = state.tokenHoldings * state.currentPrice;
    return currentValue - state.totalCost;
}

// Update display
function updateDisplay() {
    const avgPrice = state.tokenHoldings > 0 ? state.totalCost / state.tokenHoldings : 0;
    const currentValue = state.tokenHoldings * state.currentPrice;
    const unrealizedPnl = calculateUnrealizedPnl();
    const totalPortfolioValue = state.cashBalance + currentValue;
    const totalChange = totalPortfolioValue - state.initialBalance;
    const totalChangePct = (totalChange / state.initialBalance) * 100;
    
    // Price change calculation
    const priceChange = state.lastPrice > 0 ? ((state.currentPrice - state.lastPrice) / state.lastPrice) * 100 : 0;
    
    // Update connection status
    const connectionStatus = document.getElementById('connectionStatus');
    if (state.isConnected && Date.now() - state.lastUpdateTime < 5000) {
        connectionStatus.textContent = 'Connected';
        connectionStatus.className = 'connection-status connected';
    } else {
        connectionStatus.textContent = 'Disconnected';
        connectionStatus.className = 'connection-status disconnected';
    }
    
    // Update market data
    document.getElementById('tokenName').textContent = state.tokenName;
    document.getElementById('tokenPrice').textContent = `${state.currentMktCap}`;
    // document.getElementById('priceChange').innerHTML = `${priceChange >= 0 ? '+' : ''}${priceChange.toFixed(2)}%`;
    // document.getElementById('priceChange').className = `price-change ${priceChange >= 0 ? 'positive' : 'negative'}`;
    
    // Update position
    document.getElementById('holdings').textContent = state.tokenHoldings.toFixed(4);
    document.getElementById('avgPrice').textContent = `$${avgPrice.toFixed(6)}`;
    document.getElementById('currentValue').textContent = `$${currentValue.toFixed(2)}`;
    document.getElementById('unrealizedPnl').textContent = `$${unrealizedPnl.toFixed(2)}`;
    document.getElementById('unrealizedPnl').className = `stat-value ${unrealizedPnl >= 0 ? 'positive' : 'negative'}`;
    document.getElementById('realizedPnl').textContent = `$${state.realizedPnl.toFixed(2)}`;
    document.getElementById('realizedPnl').className = `stat-value ${state.realizedPnl >= 0 ? 'positive' : 'negative'}`;
    document.getElementById('cashBalance').textContent = `$${state.cashBalance.toFixed(2)}`;
    
    // Update portfolio summary
    document.getElementById('totalValue').textContent = `$${totalPortfolioValue.toFixed(2)}`;
    document.getElementById('totalChange').textContent = `${totalChange >= 0 ? '+' : ''}$${totalChange.toFixed(2)} (${totalChangePct.toFixed(2)}%)`;
    document.getElementById('totalChange').className = `portfolio-change ${totalChange >= 0 ? 'positive' : 'negative'}`;
    
    document.getElementById('totalUnrealized').textContent = `$${unrealizedPnl.toFixed(2)}`;
    document.getElementById('totalUnrealized').className = `portfolio-value ${unrealizedPnl >= 0 ? 'positive' : 'negative'}`;
    document.getElementById('totalUnrealizedPct').textContent = `${state.totalCost > 0 ? ((unrealizedPnl / state.totalCost) * 100).toFixed(2) : '0.00'}%`;
    document.getElementById('totalUnrealizedPct').className = `portfolio-change ${unrealizedPnl >= 0 ? 'positive' : 'negative'}`;
    
    document.getElementById('totalRealized').textContent = `$${state.realizedPnl.toFixed(2)}`;
    document.getElementById('totalRealized').className = `portfolio-value ${state.realizedPnl >= 0 ? 'positive' : 'negative'}`;
    document.getElementById('totalRealizedPct').textContent = `${state.realizedPnl >= 0 ? '+' : ''}${((state.realizedPnl / state.initialBalance) * 100).toFixed(2)}%`;
    document.getElementById('totalRealizedPct').className = `portfolio-change ${state.realizedPnl >= 0 ? 'positive' : 'negative'}`;
}

// Show notification
function showNotification(message, type) {
    // Remove existing notifications
    const existing = document.querySelector('.notification');
    if (existing) {
        existing.remove();
    }
    
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.remove();
    }, 3000);
}

// Listen for price updates from content script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'priceUpdate' && request.price !== null) {
        const newTokenId = state.tokenId; // Will be updated in next requestCurrentPrice call
        
        state.lastPrice = state.currentPrice || request.price;
        state.currentPrice = request.price;
        state.currentMktCap = request.mktCap;
        state.tokenName = request.name || 'UNKNOWN';
        state.isConnected = true;
        state.lastUpdateTime = Date.now();
        
        updateDisplay();
    }
});

// Initialize extension
async function initialize() {
    await loadState();
    updateDisplay();
    
    // Try to get initial price
    await requestCurrentPrice();
    
    // Set up periodic price requests as backup
    setInterval(async () => {
        if (!state.isConnected || Date.now() - state.lastUpdateTime > 3000) {
            await requestCurrentPrice();
        }
    }, 2000);
    
    // Auto-save state periodically
    setInterval(saveState, 5000);
}

// Start the extension
initialize();
