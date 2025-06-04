function convertCustomDecimal(input) {
    const subscriptMap = {
        '₀': 0, '₁': 1, '₂': 2, '₃': 3, '₄': 4,
        '₅': 5, '₆': 6, '₇': 7, '₈': 8, '₉': 9
    };

    const match = input.match(/^0\.0([₀₁₂₃₄₅₆₇₈₉])(\d+)$/);
    if (!match) {
        return input
    }

    const subscriptChar = match[1];
    const digits = match[2];
    const shift = subscriptMap[subscriptChar];

    const result = "0." + "0".repeat(shift) + digits;
    return result;
}

// Content script to extract price data
function getCurrentTokenPrice() {
  const priceElement = document.querySelectorAll('span[class="font-medium text-grey-50"]')[1];
  if (priceElement?.innerText) {
    const priceText = convertCustomDecimal(priceElement.innerText.substring(1));
    const price = parseFloat(priceText);
    return isNaN(price) ? null : price;
  }
  return null;
}

// Content script to extract mkt cap data
function getCurrentTokenMktCap() {
  const mktCapElement = document.querySelectorAll('span[class="font-medium text-grey-50"]')[2];
  if (mktCapElement?.innerText) {
    const mktCap = mktCapElement.innerText
    return mktCap;
  }
  return null;
}

function getCurrentTokenName() {
  return document.title.split('$')[0]
}

function getCurrentTokenId(){
  return new URL(location.href).searchParams.get('address');
}

// Listen for messages from sidepanel
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'getCurrentPrice') {
    const price = getCurrentTokenPrice();
    const name = getCurrentTokenName();
    const id = getCurrentTokenId();
    const mktCap = getCurrentTokenMktCap();
    sendResponse({ mktCap, price, name, id });
  }
});

// Send price updates periodically
setInterval(() => {
  const price = getCurrentTokenPrice();
  const name = getCurrentTokenName();
  const id = getCurrentTokenId();
  const mktCap = getCurrentTokenMktCap();
  if (price !== null) {
    chrome.runtime.sendMessage({
      action: 'priceUpdate',
      mktCap: mktCap,
      price: price,
      name: name,
      id: id
    }).catch(() => {
      // Ignore errors when sidepanel is closed
    });
  }
}, 1000);