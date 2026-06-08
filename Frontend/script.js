const API_BASE_URL = 'http://localhost:5255/api';

// Global Application State
let productsList = [];
let currentPage = 1;
let totalPages = 1;
let currentSearch = '';
let currentCategoryId = null;
let currentMinPrice = '';
let currentMaxPrice = '';

let cart = JSON.parse(localStorage.getItem('sofa_cart')) || [];
let activeProduct = null;
let selectedColor = null;
let selectedMaterial = null;
let selectedRating = 5;

// Auth State
let token = localStorage.getItem('sofa_token');
let username = localStorage.getItem('sofa_username');
let role = localStorage.getItem('sofa_role');
let userId = localStorage.getItem('sofa_userid');

// Initialize on load
document.addEventListener('DOMContentLoaded', () => {
    initAuthUI();
    fetchProducts(currentPage);
    loadRecommendations();
    updateCartUI();

    // Debounced search (300ms)
    let debounceTimer;
    const searchInput = document.getElementById('search-input');
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            clearTimeout(debounceTimer);
            debounceTimer = setTimeout(() => {
                currentSearch = e.target.value;
                currentPage = 1;
                fetchProducts(currentPage);
            }, 300);
        });
    }
});

// Scroll to shop helper
function scrollToShop() {
    document.getElementById('shop-section').scrollIntoView({ behavior: 'smooth' });
}

// Cookie Helper Functions for Content-based Recommendation System
function setCookie(name, value, days) {
    let expires = "";
    if (days) {
        let date = new Date();
        date.setTime(date.getTime() + (days * 24 * 60 * 60 * 1000));
        expires = "; expires=" + date.toUTCString();
    }
    document.cookie = name + "=" + (value || "") + expires + "; path=/; SameSite=Lax";
}

function getCookie(name) {
    let nameEQ = name + "=";
    let ca = document.cookie.split(';');
    for (let i = 0; i < ca.length; i++) {
        let c = ca[i];
        while (c.charAt(0) == ' ') c = c.substring(1, c.length);
        if (c.indexOf(nameEQ) == 0) return c.substring(nameEQ.length, c.length);
    }
    return null;
}

// Add viewed category to cookie (for Content-based recommendations)
function logViewedCategory(categoryId) {
    if (!categoryId) return;
    let viewed = getCookie('viewed_categories');
    let ids = viewed ? viewed.split(',') : [];
    
    // Check if category is already logged, if not add it
    if (!ids.includes(categoryId.toString())) {
        ids.push(categoryId.toString());
        // Limit to last 5 viewed categories
        if (ids.length > 5) {
            ids.shift();
        }
        setCookie('viewed_categories', ids.join(','), 7); // Save for 7 days
    }
    // Reload recommendations list to adapt instantly
    loadRecommendations();
}

// Load Content-based Sofa Recommendations
async function loadRecommendations() {
    try {
        const categoryIds = getCookie('viewed_categories') || '';
        const res = await fetch(`${API_BASE_URL}/products/recommendations?categoryIds=${categoryIds}`);
        if (!res.ok) throw new Error("Failed to load recommendations");
        
        const data = await res.json();
        renderRecommendations(data);
    } catch (err) {
        console.error("Recommendations error:", err);
    }
}

function renderRecommendations(products) {
    const grid = document.getElementById('recommendations-grid');
    if (!grid) return;

    if (!products || products.length === 0) {
        grid.innerHTML = '<div style="grid-column: 1/-1; text-align: center; color: var(--text-muted);">Không có gợi ý sản phẩm phù hợp.</div>';
        return;
    }

    grid.innerHTML = products.map(p => {
        // Find starting price
        const startingPrice = p.productVariants && p.productVariants.length > 0
            ? Math.min(...p.productVariants.map(v => v.price))
            : 0;

        return `
            <div class="product-card" onclick="openProductModal(${p.id})">
                <div class="product-image-container">
                    <img src="${p.imageUrl}" class="product-image" alt="${p.name}">
                    <span class="product-category-tag">${p.categoryId === 1 ? 'Sofa Da' : 'Sofa Nỉ'}</span>
                </div>
                <div class="product-info">
                    <h3 class="product-title">${p.name}</h3>
                    <div class="product-rating">
                        ${renderStars(p.averageRating)}
                        <span class="rating-count">(${p.averageRating})</span>
                    </div>
                    <div class="product-price">${formatVND(startingPrice)}</div>
                </div>
            </div>
        `;
    }).join('');
}

// Star rating renderer helper
function renderStars(rating) {
    const fullStars = Math.floor(rating);
    const halfStar = rating % 1 >= 0.5 ? 1 : 0;
    const emptyStars = 5 - fullStars - halfStar;
    
    let starsHtml = '';
    for (let i = 0; i < fullStars; i++) starsHtml += '★';
    if (halfStar) starsHtml += '½'; // or empty star for simplicity
    for (let i = 0; i < emptyStars; i++) starsHtml += '☆';
    return starsHtml;
}

// Fetch and render products listing
async function fetchProducts(page = 1) {
    try {
        let url = `${API_BASE_URL}/products?page=${page}&pageSize=6`;
        if (currentSearch) url += `&search=${encodeURIComponent(currentSearch)}`;
        if (currentCategoryId) url += `&categoryId=${currentCategoryId}`;
        if (currentMinPrice) url += `&minPrice=${currentMinPrice}`;
        if (currentMaxPrice) url += `&maxPrice=${currentMaxPrice}`;

        const res = await fetch(url);
        if (!res.ok) throw new Error("Could not load products");
        
        const data = await res.json();
        productsList = data.products;
        currentPage = data.page;
        totalPages = data.totalPages;

        renderProducts(productsList);
        renderPagination();
    } catch (err) {
        showToast(err.message, 'error');
    }
}

function renderProducts(products) {
    const grid = document.getElementById('products-grid');
    if (!grid) return;

    if (!products || products.length === 0) {
        grid.innerHTML = '<div style="grid-column: 1/-1; text-align: center; padding: 4rem; color: var(--text-muted);">Không tìm thấy Sofa phù hợp với tiêu chí lọc.</div>';
        return;
    }

    grid.innerHTML = products.map(p => {
        const startingPrice = p.productVariants && p.productVariants.length > 0
            ? Math.min(...p.productVariants.map(v => v.price))
            : 0;

        return `
            <div class="product-card" onclick="openProductModal(${p.id})">
                <div class="product-image-container">
                    <img src="${p.imageUrl}" class="product-image" alt="${p.name}">
                    <span class="product-category-tag">${p.category ? p.category.name : (p.categoryId === 1 ? 'Sofa Da' : 'Sofa Nỉ')}</span>
                </div>
                <div class="product-info">
                    <h3 class="product-title">${p.name}</h3>
                    <div class="product-rating">
                        ${renderStars(p.averageRating)}
                        <span class="rating-count">(${p.averageRating})</span>
                    </div>
                    <div class="product-price">${formatVND(startingPrice)}</div>
                </div>
            </div>
        `;
    }).join('');
}

function renderPagination() {
    const container = document.getElementById('pagination-controls');
    if (!container) return;

    if (totalPages <= 1) {
        container.innerHTML = '';
        return;
    }

    let html = `
        <button class="page-btn" ${currentPage === 1 ? 'disabled' : ''} onclick="changePage(${currentPage - 1})">
            &lt;
        </button>
    `;

    for (let i = 1; i <= totalPages; i++) {
        html += `
            <button class="page-btn ${currentPage === i ? 'active' : ''}" onclick="changePage(${i})">
                ${i}
            </button>
        `;
    }

    html += `
        <button class="page-btn" ${currentPage === totalPages ? 'disabled' : ''} onclick="changePage(${currentPage + 1})">
            &gt;
        </button>
    `;

    container.innerHTML = html;
}

function changePage(page) {
    if (page < 1 || page > totalPages) return;
    fetchProducts(page);
    scrollToShop();
}

// Category filter selection
function filterByCategory(catId, btn) {
    // Toggle active button
    const buttons = document.querySelectorAll('.category-btn');
    buttons.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');

    currentCategoryId = catId;
    currentPage = 1;
    fetchProducts(currentPage);
}

// Navbar specific category selection shortcut
function showCategory(catId) {
    const buttons = document.querySelectorAll('.category-btn');
    buttons.forEach(b => {
        b.classList.remove('active');
        // matching index or id
    });
    // Find sidebar button
    const targetBtn = document.querySelector(`.category-btn[onclick*="${catId}"]`);
    if (targetBtn) targetBtn.classList.add('active');

    currentCategoryId = catId;
    currentPage = 1;
    fetchProducts(currentPage);
    scrollToShop();
}

// Price range filters
function applyPriceFilter() {
    currentMinPrice = document.getElementById('min-price-input').value;
    currentMaxPrice = document.getElementById('max-price-input').value;
    currentPage = 1;
    fetchProducts(currentPage);
}

// --- PRODUCT DETAIL MODAL & VARIANT SELECTOR ---
async function openProductModal(productId) {
    try {
        const res = await fetch(`${API_BASE_URL}/products/${productId}`);
        if (!res.ok) throw new Error("Could not fetch product details");

        const product = await res.json();
        activeProduct = product;

        // Log Viewed Category to Cookie for Smart Recommendations
        logViewedCategory(product.categoryId);

        // Populate Modal Fields
        document.getElementById('modal-product-img').src = product.imageUrl;
        document.getElementById('modal-product-category').textContent = product.category ? product.category.name : (product.categoryId === 1 ? 'Sofa Da' : 'Sofa Nỉ');
        document.getElementById('modal-product-title').textContent = product.name;
        document.getElementById('modal-product-desc').textContent = product.description;
        document.getElementById('modal-product-rating').innerHTML = renderStars(product.averageRating) + `<span class="rating-count">(${product.averageRating} / 5.0)</span>`;

        // Configure Variant Selector Pills
        setupVariantPills(product.productVariants);

        // Render Reviews list
        renderReviewsList(product.reviews);

        // Open Modal Overlay
        const modal = document.getElementById('product-detail-modal');
        modal.classList.add('active');
        document.body.style.overflow = 'hidden'; // Lock background scroll

        // Reset review form values
        setReviewRating(5);
        document.getElementById('review-comment-input').value = '';

        // Check if user is logged in to show review input
        if (token) {
            document.getElementById('review-submission-form-container').style.display = 'block';
            document.getElementById('review-login-prompt').style.display = 'none';
        } else {
            document.getElementById('review-submission-form-container').style.display = 'none';
            document.getElementById('review-login-prompt').style.display = 'block';
        }

    } catch (err) {
        showToast(err.message, 'error');
    }
}

function closeProductModal() {
    const modal = document.getElementById('product-detail-modal');
    modal.classList.remove('active');
    document.body.style.overflow = ''; // Restore scroll
    activeProduct = null;
}

// Render available options inside modal
function setupVariantPills(variants) {
    const colorContainer = document.getElementById('color-variant-pills');
    const materialContainer = document.getElementById('material-variant-pills');

    // Extract unique colors and materials
    const colors = [...new Set(variants.map(v => v.color))];
    const materials = [...new Set(variants.map(v => v.material))];

    // Reset Active Selections
    selectedColor = colors[0];
    selectedMaterial = materials[0];

    // Render Colors
    colorContainer.innerHTML = colors.map(color => `
        <button class="variant-pill ${color === selectedColor ? 'active' : ''}" onclick="selectVariantOption('color', '${color}', this)">
            ${color}
        </button>
    `).join('');

    // Render Materials
    materialContainer.innerHTML = materials.map(mat => `
        <button class="variant-pill ${mat === selectedMaterial ? 'active' : ''}" onclick="selectVariantOption('material', '${mat}', this)">
            ${mat}
        </button>
    `).join('');

    // Update Price and Stock display based on current selection
    updateActiveVariantDisplay();
}

function selectVariantOption(type, value, btnElement) {
    // Remove active styling from siblings
    const siblings = btnElement.parentElement.children;
    for (let sibling of siblings) {
        sibling.classList.remove('active');
    }
    btnElement.classList.add('active');

    if (type === 'color') {
        selectedColor = value;
    } else {
        selectedMaterial = value;
    }

    updateActiveVariantDisplay();
}

function updateActiveVariantDisplay() {
    if (!activeProduct) return;

    // Find the variant that matches selected color and material
    const matchingVariant = activeProduct.productVariants.find(v => v.color === selectedColor && v.material === selectedMaterial);
    const priceDisplay = document.getElementById('modal-product-price');
    const stockDisplay = document.getElementById('modal-product-stock');
    const addToCartBtn = document.getElementById('add-to-cart-btn');

    if (matchingVariant) {
        priceDisplay.textContent = formatVND(matchingVariant.price);
        
        if (matchingVariant.stock > 0) {
            stockDisplay.textContent = `${matchingVariant.stock} sản phẩm còn lại`;
            stockDisplay.style.color = 'var(--success)';
            addToCartBtn.disabled = false;
            addToCartBtn.innerHTML = `
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                    <circle cx="9" cy="21" r="1"></circle>
                    <circle cx="20" cy="21" r="1"></circle>
                    <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path>
                </svg> Thêm Vào Giỏ Hàng`;
        } else {
            stockDisplay.textContent = 'Hết hàng';
            stockDisplay.style.color = 'var(--danger)';
            addToCartBtn.disabled = true;
            addToCartBtn.textContent = 'Hết Hàng';
        }
    } else {
        // Fallback if this combination does not exist
        priceDisplay.textContent = 'N/A';
        stockDisplay.textContent = 'Liên hệ cửa hàng';
        stockDisplay.style.color = 'var(--text-muted)';
        addToCartBtn.disabled = true;
        addToCartBtn.textContent = 'Không Có Biến Thể';
    }
}

// Render Product Reviews List
function renderReviewsList(reviews) {
    const container = document.getElementById('reviews-list-container');
    if (!container) return;

    if (!reviews || reviews.length === 0) {
        container.innerHTML = '<p style="color: var(--text-muted); font-size: 0.95rem;">Chưa có đánh giá nào cho sản phẩm này. Hãy mua và viết đánh giá đầu tiên!</p>';
        return;
    }

    container.innerHTML = reviews.map(r => `
        <div class="review-card">
            <div class="review-header">
                <span class="review-user">${r.user ? r.user.username : 'Khách hàng'}</span>
                <span class="review-stars">${'★'.repeat(r.rating) + '☆'.repeat(5 - r.rating)}</span>
            </div>
            <p class="review-comment">${r.comment}</p>
            <span style="font-size: 0.75rem; color: var(--text-muted); display: block; margin-top: 0.5rem;">
                ${new Date(r.createdAt).toLocaleDateString('vi-VN')}
            </span>
        </div>
    `).join('');
}

// Set rating value in form
function setReviewRating(rating) {
    selectedRating = rating;
    const stars = document.querySelectorAll('#rating-star-selector .rating-star-btn');
    stars.forEach((star, idx) => {
        if (idx < rating) {
            star.classList.add('active');
        } else {
            star.classList.remove('active');
        }
    });
}

// Submit Review (Checks with backend validation)
async function submitReview() {
    if (!token) {
        showToast("Vui lòng đăng nhập để đánh giá.", "error");
        return;
    }

    const comment = document.getElementById('review-comment-input').value.trim();
    if (!comment) {
        showToast("Vui lòng nhập bình luận đánh giá.", "error");
        return;
    }

    try {
        const res = await fetch(`${API_BASE_URL}/products/${activeProduct.id}/reviews`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                rating: selectedRating,
                comment: comment
            })
        });

        const data = await res.json();
        
        if (!res.ok) {
            throw new Error(data.message || "Không thể gửi đánh giá.");
        }

        showToast(data.message, "success");
        
        // Reload modal details to refresh reviews and average rating
        openProductModal(activeProduct.id);
        
        // Re-fetch products lists to show updated average rating stars
        fetchProducts(currentPage);

    } catch (err) {
        showToast(err.message, "error");
    }
}


// --- SHOPPING CART AJAX PROCESSOR & AUTO-COUPON ---

function toggleCart(isOpen) {
    const drawer = document.getElementById('cart-drawer');
    if (isOpen) {
        drawer.classList.add('active');
        updateCartUI(); // Fetch and scan coupons automatically
    } else {
        drawer.classList.remove('active');
    }
}

function addToCartFromModal() {
    if (!activeProduct) return;

    const variant = activeProduct.productVariants.find(v => v.color === selectedColor && v.material === selectedMaterial);
    if (!variant) return;

    // Check if variant already exists in cart
    const existingIndex = cart.findIndex(item => item.variantId === variant.id);

    if (existingIndex > -1) {
        if (cart[existingIndex].qty + 1 > variant.stock) {
            showToast(`Không thể mua thêm. Kho chỉ còn ${variant.stock} sản phẩm.`, "error");
            return;
        }
        cart[existingIndex].qty += 1;
    } else {
        cart.push({
            variantId: variant.id,
            productId: activeProduct.id,
            name: activeProduct.name,
            color: variant.color,
            material: variant.material,
            price: variant.price,
            imageUrl: activeProduct.imageUrl,
            qty: 1,
            maxStock: variant.stock
        });
    }

    localStorage.setItem('sofa_cart', JSON.stringify(cart));
    showToast("Đã thêm vào giỏ hàng!", "success");
    
    // Update badge count
    updateCartBadge();
    
    // Open cart drawer
    toggleCart(true);
}

function updateCartBadge() {
    const badge = document.getElementById('cart-badge-count');
    if (badge) {
        const totalQty = cart.reduce((sum, item) => sum + item.qty, 0);
        badge.textContent = totalQty;
    }
}

// Fetch coupons & automatically calculate the highest discount for total
async function updateCartUI() {
    updateCartBadge();
    
    const listContainer = document.getElementById('cart-items-list');
    if (!listContainer) return;

    if (cart.length === 0) {
        listContainer.innerHTML = '<div style="text-align: center; padding: 4rem 1rem; color: var(--text-muted);">Giỏ hàng đang trống.</div>';
        document.getElementById('cart-subtotal-val').textContent = '0đ';
        document.getElementById('cart-total-val').textContent = '0đ';
        document.getElementById('cart-discount-row').style.display = 'none';
        document.getElementById('auto-coupon-banner').style.display = 'none';
        return;
    }

    listContainer.innerHTML = cart.map((item, index) => `
        <div class="cart-item">
            <img src="${item.imageUrl}" class="cart-item-img" alt="${item.name}">
            <div class="cart-item-details">
                <div class="cart-item-title">${item.name}</div>
                <div class="cart-item-variant">Màu: ${item.color} | Chất liệu: ${item.material}</div>
                <div class="cart-item-price">${formatVND(item.price)}</div>
                <div class="cart-item-qty">
                    <button class="qty-btn" onclick="adjustCartQty(${index}, -1)">-</button>
                    <span>${item.qty}</span>
                    <button class="qty-btn" onclick="adjustCartQty(${index}, 1)">+</button>
                </div>
            </div>
            <button class="cart-item-remove" onclick="removeCartItem(${index})">×</button>
        </div>
    `).join('');

    const subtotal = cart.reduce((sum, item) => sum + (item.price * item.qty), 0);
    document.getElementById('cart-subtotal-val').textContent = formatVND(subtotal);

    // --- AUTO-APPLY COUPON ENGINE ---
    try {
        const res = await fetch(`${API_BASE_URL}/orders/coupons`);
        if (!res.ok) throw new Error("Could not fetch coupons");

        const coupons = await res.json();
        
        let bestCoupon = null;
        let maxDiscount = 0;

        // Scan the coupon table and calculate the best saving
        for (let coupon of coupons) {
            if (subtotal >= coupon.minOrderAmount) {
                let discount = 0;
                if (coupon.discountType.toLowerCase() === 'percentage') {
                    discount = subtotal * (coupon.discountValue / 100);
                    if (discount > coupon.maxDiscountAmount) {
                        discount = coupon.maxDiscountAmount;
                    }
                } else if (coupon.discountType.toLowerCase() === 'fixed') {
                    discount = coupon.discountValue;
                }

                if (discount > maxDiscount) {
                    maxDiscount = discount;
                    bestCoupon = coupon;
                }
            }
        }

        const discountRow = document.getElementById('cart-discount-row');
        const discountVal = document.getElementById('cart-discount-val');
        const couponBanner = document.getElementById('auto-coupon-banner');
        const totalVal = document.getElementById('cart-total-val');

        if (bestCoupon && maxDiscount > 0) {
            const finalAmount = Math.max(0, subtotal - maxDiscount);
            
            // Render discount UI elements
            discountVal.textContent = `-${formatVND(maxDiscount)}`;
            discountRow.style.display = 'flex';
            
            couponBanner.innerHTML = `
                <div class="coupon-box">
                    <span>Áp dụng tự động mã: <span class="coupon-code">${bestCoupon.code}</span></span>
                    <span>Tiết kiệm: <strong>${formatVND(maxDiscount)}</strong></span>
                </div>
            `;
            couponBanner.style.display = 'block';
            
            totalVal.textContent = formatVND(finalAmount);
        } else {
            // No coupon applied
            discountRow.style.display = 'none';
            couponBanner.style.display = 'none';
            totalVal.textContent = formatVND(subtotal);
        }

    } catch (err) {
        console.error("Auto coupon error:", err);
        // Fallback: regular subtotal with no discount
        document.getElementById('cart-total-val').textContent = formatVND(subtotal);
        document.getElementById('cart-discount-row').style.display = 'none';
        document.getElementById('auto-coupon-banner').style.display = 'none';
    }
}

function adjustCartQty(index, change) {
    const item = cart[index];
    const newQty = item.qty + change;
    
    if (newQty < 1) {
        removeCartItem(index);
        return;
    }

    if (newQty > item.maxStock) {
        showToast(`Không đủ hàng trong kho. Tối đa: ${item.maxStock}`, "error");
        return;
    }

    item.qty = newQty;
    localStorage.setItem('sofa_cart', JSON.stringify(cart));
    updateCartUI();
}

function removeCartItem(index) {
    cart.splice(index, 1);
    localStorage.setItem('sofa_cart', JSON.stringify(cart));
    updateCartUI();
    showToast("Đã xóa sản phẩm khỏi giỏ hàng", "info");
}

// Checkout triggers backend transaction
async function processCheckout() {
    if (!token) {
        showToast("Vui lòng đăng nhập để tiến hành đặt hàng.", "error");
        toggleCart(false);
        openAuthModal('login');
        return;
    }

    if (cart.length === 0) {
        showToast("Giỏ hàng rỗng.", "error");
        return;
    }

    // Prepare checkout payload
    const orderDetails = cart.map(item => ({
        productVariantId: item.variantId,
        quantity: item.qty
    }));

    try {
        const checkoutBtn = document.getElementById('checkout-btn');
        checkoutBtn.disabled = true;
        checkoutBtn.textContent = 'Đang giao dịch...';

        const res = await fetch(`${API_BASE_URL}/orders/checkout`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ orderDetails })
        });

        const data = await res.json();

        if (!res.ok) {
            throw new Error(data.message || "Đặt hàng thất bại");
        }

        // Checkout success
        showToast(`Đặt hàng thành công! Mã đơn hàng: #${data.orderId}. Số tiền: ${formatVND(data.finalAmount)}`, "success");
        
        // Reset Cart
        cart = [];
        localStorage.removeItem('sofa_cart');
        
        // Reset UI
        toggleCart(false);
        updateCartUI();
        
        // Refresh products list to show new stocks
        fetchProducts(currentPage);

    } catch (err) {
        showToast(err.message, "error");
    } finally {
        const checkoutBtn = document.getElementById('checkout-btn');
        checkoutBtn.disabled = false;
        checkoutBtn.textContent = 'Tiến Hành Đặt Hàng (Giao Dịch Lập Tức)';
    }
}


// --- AUTHENTICATION MODALS & LOGIN/REGISTER FLOW ---

function openAuthModal(mode = 'login') {
    const modal = document.getElementById('auth-modal');
    modal.classList.add('active');
    document.body.style.overflow = 'hidden';
    switchAuthMode(mode);
}

function closeAuthModal() {
    const modal = document.getElementById('auth-modal');
    modal.classList.remove('active');
    document.body.style.overflow = '';
}

function switchAuthMode(mode) {
    activeAuthMode = mode;
    const loginWrapper = document.getElementById('login-form-wrapper');
    const registerWrapper = document.getElementById('register-form-wrapper');

    if (mode === 'login') {
        loginWrapper.style.display = 'block';
        registerWrapper.style.display = 'none';
    } else {
        loginWrapper.style.display = 'none';
        registerWrapper.style.display = 'block';
    }
}

async function handleLogin() {
    const usernameInput = document.getElementById('login-username').value.trim();
    const passwordInput = document.getElementById('login-password').value.trim();

    if (!usernameInput || !passwordInput) {
        showToast("Vui lòng điền đầy đủ tài khoản và mật khẩu.", "error");
        return;
    }

    try {
        const res = await fetch(`${API_BASE_URL}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: usernameInput, password: passwordInput })
        });

        const data = await res.json();
        
        if (!res.ok) {
            throw new Error(data.message || "Đăng nhập thất bại.");
        }

        // Save token state
        token = data.token;
        username = data.username;
        role = data.role;
        userId = data.userId;

        localStorage.setItem('sofa_token', token);
        localStorage.setItem('sofa_username', username);
        localStorage.setItem('sofa_role', role);
        localStorage.setItem('sofa_userid', userId);

        showToast("Đăng nhập thành công!", "success");
        closeAuthModal();
        
        // Refresh UI components
        initAuthUI();
        
        // Refresh detail reviews form if active
        if (activeProduct) {
            openProductModal(activeProduct.id);
        }

    } catch (err) {
        showToast(err.message, "error");
    }
}

async function handleRegister() {
    const usernameInput = document.getElementById('register-username').value.trim();
    const emailInput = document.getElementById('register-email').value.trim();
    const passwordInput = document.getElementById('register-password').value.trim();

    if (!usernameInput || !emailInput || !passwordInput) {
        showToast("Vui lòng điền đầy đủ thông tin đăng ký.", "error");
        return;
    }

    try {
        const res = await fetch(`${API_BASE_URL}/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: usernameInput, email: emailInput, password: passwordInput })
        });

        const data = await res.json();

        if (!res.ok) {
            throw new Error(data.message || "Đăng ký tài khoản lỗi.");
        }

        showToast("Đăng ký thành công! Hãy đăng nhập.", "success");
        switchAuthMode('login');

        // Fill username into login field automatically
        document.getElementById('login-username').value = usernameInput;

    } catch (err) {
        showToast(err.message, "error");
    }
}

function handleLogout() {
    token = null;
    username = null;
    role = null;
    userId = null;

    localStorage.removeItem('sofa_token');
    localStorage.removeItem('sofa_username');
    localStorage.removeItem('sofa_role');
    localStorage.removeItem('sofa_userid');

    showToast("Đã đăng xuất tài khoản.", "info");
    initAuthUI();

    if (activeProduct) {
        openProductModal(activeProduct.id);
    }
}

function initAuthUI() {
    const container = document.getElementById('auth-nav-section');
    const adminLink = document.getElementById('admin-nav-link');
    if (!container) return;

    if (token && username) {
        container.innerHTML = `
            <div style="display: flex; align-items: center; gap: 1rem;">
                <span style="font-size: 0.95rem; font-weight: 500; color: var(--primary);">Chào, ${username}</span>
                <button class="btn btn-secondary" onclick="handleLogout()" style="padding: 0.5rem 1rem; font-size: 0.85rem;">Đăng Xuất</button>
            </div>
        `;

        if (role === 'Admin') {
            if (adminLink) adminLink.style.display = 'block';
        } else {
            if (adminLink) adminLink.style.display = 'none';
        }
    } else {
        container.innerHTML = `
            <button class="btn btn-secondary" onclick="openAuthModal('login')" style="padding: 0.5rem 1.25rem; font-size: 0.9rem;">Đăng Nhập</button>
        `;
        if (adminLink) adminLink.style.display = 'none';
    }
}

// --- UTILITY HELPER FUNCTIONS ---

function formatVND(amount) {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);
}

function showToast(message, type = 'info') {
    const toast = document.getElementById('toast-notification');
    const msgContainer = document.getElementById('toast-message');
    if (!toast || !msgContainer) return;

    msgContainer.textContent = message;
    toast.className = `toast ${type} active`;

    setTimeout(() => {
        toast.classList.remove('active');
    }, 4000);
}
