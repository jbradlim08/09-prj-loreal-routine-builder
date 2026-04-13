/* Get references to DOM elements */
const categoryFilter = document.getElementById("categoryFilter");
const productsContainer = document.getElementById("productsContainer");
const selectedProductsList = document.getElementById("selectedProductsList");
const clearSelectionsBtn = document.getElementById("clearSelections");
const generateRoutineBtn = document.getElementById("generateRoutine");
const chatForm = document.getElementById("chatForm");
const chatWindow = document.getElementById("chatWindow");
const userInputField = document.getElementById("userInput");
const sendBtn = document.getElementById("sendBtn");
const productModal = document.getElementById("productModal");
const productModalClose = document.getElementById("productModalClose");
const productModalImage = document.getElementById("productModalImage");
const productModalBrand = document.getElementById("productModalBrand");
const productModalTitle = document.getElementById("productModalTitle");
const productModalDescription = document.getElementById("productModalDescription");
const selectedProducts = new Map();

let allProducts = [];
let currentProducts = [];
const WORKER_URL =
  window.CLOUDFLARE_WORKER_URL || window.WORKER_URL || window.API_PROXY_URL || "";
const SELECTED_PRODUCTS_STORAGE_KEY = "lorealSelectedProducts";
const BASE_SYSTEM_PROMPT =
  "You are a skincare and beauty routine advisor. You must stay within skincare, haircare, makeup, fragrance, personal care, and the generated routine context. If a question is unrelated, politely decline and redirect to those topics.";
let conversationHistory = [];
let hasGeneratedRoutine = false;

/* Show initial placeholder until user selects a category */
productsContainer.innerHTML = `
  <div class="placeholder-message">
    Select a category to view products
  </div>
`;

/* Load product data from JSON file */
async function loadProducts() {
  const response = await fetch("products.json");
  const data = await response.json();
  return data.products;
}

function saveSelectedProductsToStorage() {
  try {
    const selected = Array.from(selectedProducts.values());
    localStorage.setItem(SELECTED_PRODUCTS_STORAGE_KEY, JSON.stringify(selected));
  } catch (error) {
    console.error("Could not save selected products:", error);
  }
}

function loadSelectedProductsFromStorage() {
  try {
    const rawValue = localStorage.getItem(SELECTED_PRODUCTS_STORAGE_KEY);
    if (!rawValue) return;

    const savedProducts = JSON.parse(rawValue);
    if (!Array.isArray(savedProducts)) return;

    savedProducts.forEach((product) => {
      if (product?.id) {
        selectedProducts.set(product.id, product);
      }
    });
  } catch (error) {
    console.error("Could not load selected products:", error);
  }
}

/* Create HTML for displaying product cards */
function displayProducts(products) {
  currentProducts = products;

  if (!products.length) {
    productsContainer.innerHTML = `
      <div class="placeholder-message">
        No products were found in this category.
      </div>
    `;
    return;
  }

  productsContainer.innerHTML = products
    .map(
      (product) => `
    <div class="product-card ${
      selectedProducts.has(product.id) ? "is-selected" : ""
    }" data-product-id="${product.id}">
      <img src="${product.image}" alt="${product.name}">
      <div class="product-info">
        <h3>${product.name}</h3>
        <p>${product.brand}</p>
        <button
          class="details-btn"
          type="button"
          data-product-id="${product.id}"
        >
          View details
        </button>
      </div>
    </div>
  `
    )
    .join("");
}

function openProductModal(product) {
  if (!product) return;

  productModalImage.src = product.image;
  productModalImage.alt = product.name;
  productModalBrand.textContent = product.brand;
  productModalTitle.textContent = product.name;
  productModalDescription.textContent = product.description;
  productModal.hidden = false;
  document.body.classList.add("modal-open");
  productModalClose.focus();
}

function closeProductModal() {
  productModal.hidden = true;
  document.body.classList.remove("modal-open");
}

function escapeHtml(text) {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function appendChatMessage(message, type = "assistant") {
  const safeMessage = escapeHtml(message).replaceAll("\n", "<br>");
  const label =
    type === "user" ? "You" : type === "error" ? "Error" : "Routine Advisor";
  const className =
    type === "user"
      ? "chat-message chat-message--user"
      : type === "error"
      ? "chat-message chat-message--error"
      : "chat-message chat-message--assistant";

  chatWindow.insertAdjacentHTML(
    "beforeend",
    `
      <div class="${className}">
        <p><strong>${label}:</strong></p>
        <p>${safeMessage}</p>
      </div>
    `
  );
  chatWindow.scrollTop = chatWindow.scrollHeight;
}

function resetChatWindow() {
  chatWindow.innerHTML = "";
}

function addPendingMessage() {
  const pendingId = `pending-${Date.now()}`;
  chatWindow.insertAdjacentHTML(
    "beforeend",
    `
      <div class="chat-message chat-message--assistant chat-message--pending" data-pending-id="${pendingId}">
        <p><strong>Routine Advisor:</strong></p>
        <p>Generating...</p>
      </div>
    `
  );
  chatWindow.scrollTop = chatWindow.scrollHeight;
  return pendingId;
}

function removePendingMessage(pendingId) {
  const pendingMessage = chatWindow.querySelector(
    `[data-pending-id="${pendingId}"]`
  );
  if (pendingMessage) {
    pendingMessage.remove();
  }
}

async function requestWorkerCompletion(messages) {
  const response = await fetch(WORKER_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ messages }),
  });

  if (!response.ok) {
    throw new Error(`Worker request failed (${response.status})`);
  }

  const data = await response.json();
  const assistantText = data.choices?.[0]?.message?.content?.trim();

  if (!assistantText) {
    throw new Error("The worker returned an empty response.");
  }

  return assistantText;
}

async function generateRoutineFromSelectedProducts() {
  if (selectedProducts.size === 0) {
    appendChatMessage(
      "Select at least one product before generating a routine.",
      "error"
    );
    return;
  }

  if (!WORKER_URL) {
    appendChatMessage(
      "Missing Cloudflare Worker URL. Add CLOUDFLARE_WORKER_URL in secrets.js.",
      "error"
    );
    return;
  }

  const selectedProductData = Array.from(selectedProducts.values()).map(
    ({ name, brand, category, description }) => ({
      name,
      brand,
      category,
      description,
    })
  );

  generateRoutineBtn.disabled = true;
  generateRoutineBtn.textContent = "Generating...";
  resetChatWindow();
  const pendingId = addPendingMessage();

  try {
    const messages = [
      {
        role: "system",
        content: BASE_SYSTEM_PROMPT,
      },
      {
        role: "user",
        content: `Selected products JSON:\n${JSON.stringify(
          selectedProductData,
          null,
          2
        )}`,
      },
      {
        role: "user",
        content:
          "Create a personalized routine using ONLY the selected products. Format with: Morning Routine, Evening Routine, and 2-4 short usage tips.",
      },
    ];

    const routineText = await requestWorkerCompletion(messages);
    conversationHistory = [
      ...messages,
      { role: "assistant", content: routineText },
    ];
    hasGeneratedRoutine = true;

    resetChatWindow();
    appendChatMessage(routineText, "assistant");
  } catch (error) {
    removePendingMessage(pendingId);
    appendChatMessage(
      `Could not generate routine. ${error.message || "Please try again."}`,
      "error"
    );
  } finally {
    generateRoutineBtn.disabled = false;
    generateRoutineBtn.innerHTML =
      '<i class="fa-solid fa-wand-magic-sparkles"></i> Generate Routine';
  }
}

/* Keep selected-products panel in sync with current selection state */
function renderSelectedProducts() {
  if (selectedProducts.size === 0) {
    selectedProductsList.innerHTML = `
      <p class="selected-empty">No products selected yet.</p>
    `;
    clearSelectionsBtn.disabled = true;
    return;
  }

  selectedProductsList.innerHTML = Array.from(selectedProducts.values())
    .map(
      (product) => `
      <div class="selected-item">
        <span>${product.name}</span>
        <button class="remove-selected-btn" data-product-id="${product.id}" aria-label="Remove ${product.name}">
          &times;
        </button>
      </div>
    `
    )
    .join("");
  clearSelectionsBtn.disabled = false;
}

function toggleProductSelection(productId) {
  const product =
    currentProducts.find((item) => item.id === productId) ||
    allProducts.find((item) => item.id === productId);

  if (!product) return;

  if (selectedProducts.has(productId)) {
    selectedProducts.delete(productId);
  } else {
    selectedProducts.set(productId, product);
  }

  saveSelectedProductsToStorage();
  renderSelectedProducts();
}

/* Select/unselect products directly from the product card grid */
productsContainer.addEventListener("click", (e) => {
  const detailsBtn = e.target.closest(".details-btn");
  if (detailsBtn) {
    const productId = Number(detailsBtn.dataset.productId);
    if (!productId) return;

    const product =
      currentProducts.find((item) => item.id === productId) ||
      allProducts.find((item) => item.id === productId);

    openProductModal(product);

    return;
  }

  const selectedCard = e.target.closest(".product-card");
  if (!selectedCard) return;

  const productId = Number(selectedCard.dataset.productId);
  if (!productId) return;

  toggleProductSelection(productId);
  selectedCard.classList.toggle("is-selected", selectedProducts.has(productId));
});

/* Remove selected products from the selected products list */
selectedProductsList.addEventListener("click", (e) => {
  const removeBtn = e.target.closest(".remove-selected-btn");
  if (!removeBtn) return;

  const productId = Number(removeBtn.dataset.productId);
  if (!productId || !selectedProducts.has(productId)) return;

  selectedProducts.delete(productId);
  saveSelectedProductsToStorage();
  renderSelectedProducts();

  const matchingCard = productsContainer.querySelector(
    `.product-card[data-product-id="${productId}"]`
  );
  if (matchingCard) {
    matchingCard.classList.remove("is-selected");
  }
});

clearSelectionsBtn.addEventListener("click", () => {
  if (selectedProducts.size === 0) return;

  selectedProducts.clear();
  saveSelectedProductsToStorage();
  renderSelectedProducts();

  productsContainer
    .querySelectorAll(".product-card.is-selected")
    .forEach((card) => card.classList.remove("is-selected"));
});

productModal.addEventListener("click", (e) => {
  if (e.target.closest("[data-modal-close='true']")) {
    closeProductModal();
  }
});

productModalClose.addEventListener("click", closeProductModal);

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && !productModal.hidden) {
    closeProductModal();
  }
});

/* Filter and display products when category changes */
categoryFilter.addEventListener("change", async (e) => {
  if (allProducts.length === 0) {
    allProducts = await loadProducts();
  }

  const selectedCategory = e.target.value;

  /* filter() creates a new array containing only products 
     where the category matches what the user selected */
  const filteredProducts = allProducts.filter(
    (product) => product.category === selectedCategory
  );

  displayProducts(filteredProducts);
});

/* Chat form submission handler - placeholder for OpenAI integration */
chatForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const question = userInputField.value.trim();
  if (!question) return;

  if (!hasGeneratedRoutine) {
    appendChatMessage(
      "Generate a routine first, then ask follow-up questions about it.",
      "error"
    );
    return;
  }

  if (!WORKER_URL) {
    appendChatMessage(
      "Missing Cloudflare Worker URL. Add CLOUDFLARE_WORKER_URL in secrets.js.",
      "error"
    );
    return;
  }

  appendChatMessage(question, "user");
  userInputField.value = "";
  sendBtn.disabled = true;
  const pendingId = addPendingMessage();

  conversationHistory.push({ role: "user", content: question });

  requestWorkerCompletion(conversationHistory)
    .then((assistantReply) => {
      removePendingMessage(pendingId);
      conversationHistory.push({ role: "assistant", content: assistantReply });
      appendChatMessage(assistantReply, "assistant");
    })
    .catch((error) => {
      removePendingMessage(pendingId);
      appendChatMessage(
        `Could not answer that follow-up. ${error.message || "Please try again."}`,
        "error"
      );
    })
    .finally(() => {
      sendBtn.disabled = false;
    });
});

generateRoutineBtn.addEventListener("click", generateRoutineFromSelectedProducts);

loadSelectedProductsFromStorage();
renderSelectedProducts();
