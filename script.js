/* Get references to DOM elements */
const categoryFilter = document.getElementById("categoryFilter");
const productsContainer = document.getElementById("productsContainer");
const selectedProductsList = document.getElementById("selectedProductsList");
const chatForm = document.getElementById("chatForm");
const chatWindow = document.getElementById("chatWindow");
const productModal = document.getElementById("productModal");
const productModalClose = document.getElementById("productModalClose");
const productModalImage = document.getElementById("productModalImage");
const productModalBrand = document.getElementById("productModalBrand");
const productModalTitle = document.getElementById("productModalTitle");
const productModalDescription = document.getElementById("productModalDescription");
const selectedProducts = new Map();

let allProducts = [];
let currentProducts = [];

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

/* Keep selected-products panel in sync with current selection state */
function renderSelectedProducts() {
  if (selectedProducts.size === 0) {
    selectedProductsList.innerHTML = `
      <p class="selected-empty">No products selected yet.</p>
    `;
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
  renderSelectedProducts();

  const matchingCard = productsContainer.querySelector(
    `.product-card[data-product-id="${productId}"]`
  );
  if (matchingCard) {
    matchingCard.classList.remove("is-selected");
  }
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

  chatWindow.innerHTML = "Connect to the OpenAI API for a response!";
});

renderSelectedProducts();
