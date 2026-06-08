const API_BASE_URL = 'http://localhost:5255/api';

// Admin Local State
let token = localStorage.getItem('sofa_token');
let role = localStorage.getItem('sofa_role');
let username = localStorage.getItem('sofa_username');

// Verification: Redirect to storefront if not authorized
document.addEventListener('DOMContentLoaded', () => {
    if (!token || role !== 'Admin') {
        alert("Quyền truy cập bị từ chối! Trang này chỉ dành cho Admin.");
        window.location.href = 'index.html';
        return;
    }

    // Load initial analytics view
    loadDashboardStats();
});

// View switcher (SPA navigation)
function switchAdminView(viewName) {
    const views = ['dashboard', 'orders', 'products'];
    views.forEach(v => {
        const viewEl = document.getElementById(`view-${v}`);
        const menuEl = document.getElementById(`menu-${v}`);
        if (v === viewName) {
            viewEl.style.display = 'block';
            menuEl.classList.add('active');
        } else {
            viewEl.style.display = 'none';
            menuEl.classList.remove('active');
        }
    });

    const titleEl = document.getElementById('admin-view-title');
    if (viewName === 'dashboard') {
        titleEl.textContent = 'Bảng Thống Kê Số Liệu';
        loadDashboardStats();
    } else if (viewName === 'orders') {
        titleEl.textContent = 'Quản Lý Đơn Hàng';
        loadOrdersTable();
    } else if (viewName === 'products') {
        titleEl.textContent = 'Quản Lý Sản Phẩm';
        loadProductsTable();
    }
}

// --- VIEW 1: LOAD REAL-TIME STATS ---
async function loadDashboardStats() {
    try {
        const res = await fetch(`${API_BASE_URL}/dashboard/stats`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!res.ok) throw new Error("Không thể tải số liệu phân tích.");

        const data = await res.json();

        // Render Cards
        document.getElementById('stat-revenue').textContent = formatVND(data.totalRevenue);
        document.getElementById('stat-ratio').textContent = `${data.successRate}% / ${data.cancelledRate}%`;
        document.getElementById('stat-orders-count').textContent = data.totalOrdersCount;

        // Render Status details
        document.getElementById('status-completed-count').textContent = `${data.successOrdersCount} đơn`;
        document.getElementById('status-pending-count').textContent = `${data.pendingOrdersCount} đơn`;
        document.getElementById('status-cancelled-count').textContent = `${data.cancelledOrdersCount} đơn`;

        // Render Top 3 selling products (JOIN & GROUP BY)
        renderTopProducts(data.topProducts);

    } catch (err) {
        showToast(err.message, 'error');
    }
}

function renderTopProducts(products) {
    const container = document.getElementById('top-products-container');
    if (!container) return;

    if (!products || products.length === 0) {
        container.innerHTML = '<p style="color: var(--text-muted);">Chưa có sản phẩm nào được bán thành công.</p>';
        return;
    }

    container.innerHTML = products.map((p, idx) => `
        <div class="top-product-item">
            <div style="font-weight: 700; font-size: 1.15rem; color: var(--primary);">#${idx + 1}</div>
            <img src="${p.imageUrl}" class="top-product-img" alt="${p.productName}">
            <div class="top-product-meta">
                <div class="top-product-title">${p.productName}</div>
                <div class="top-product-sales">Đã bán: <strong>${p.totalQuantitySold} chiếc</strong></div>
            </div>
            <div class="top-product-revenue">${formatVND(p.totalRevenueGenerated)}</div>
        </div>
    `).join('');
}

// --- VIEW 2: ORDERS MANAGEMENT ---
async function loadOrdersTable() {
    try {
        const res = await fetch(`${API_BASE_URL}/orders`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!res.ok) throw new Error("Không thể tải danh sách đơn hàng.");

        const orders = await res.json();
        renderOrdersTable(orders);

    } catch (err) {
        showToast(err.message, 'error');
    }
}

function renderOrdersTable(orders) {
    const tbody = document.getElementById('orders-table-body');
    if (!tbody) return;

    if (!orders || orders.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" style="text-align: center; color: var(--text-muted);">Không có đơn hàng nào.</td></tr>';
        return;
    }

    tbody.innerHTML = orders.map(o => {
        const dateStr = new Date(o.createdAt).toLocaleString('vi-VN');
        const statusClass = o.status.toLowerCase();

        return `
            <tr>
                <td style="font-weight: 600;">#${o.id}</td>
                <td>${o.user ? o.user.username : 'Ẩn danh'}</td>
                <td>${dateStr}</td>
                <td>${formatVND(o.totalAmount)}</td>
                <td style="color: var(--success);">${formatVND(o.discountAmount)} (${o.coupon ? o.coupon.code : 'Không'})</td>
                <td style="font-weight: 700; color: var(--primary);">${formatVND(o.finalAmount)}</td>
                <td><span class="status-badge ${statusClass}">${o.status}</span></td>
                <td>
                    <div style="display: flex; gap: 0.25rem;">
                        <button class="btn btn-secondary" onclick="updateOrderStatus(${o.id}, 'Completed')" style="padding: 0.25rem 0.5rem; font-size: 0.75rem;">Duyệt</button>
                        <button class="btn btn-danger" onclick="updateOrderStatus(${o.id}, 'Cancelled')" style="padding: 0.25rem 0.5rem; font-size: 0.75rem;">Hủy</button>
                        <button class="btn btn-secondary" onclick="updateOrderStatus(${o.id}, 'Pending')" style="padding: 0.25rem 0.5rem; font-size: 0.75rem; border-color: var(--primary); color: var(--primary);">Tạm dừng</button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');
}

async function updateOrderStatus(orderId, newStatus) {
    try {
        const res = await fetch(`${API_BASE_URL}/orders/${orderId}/status`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ status: newStatus })
        });

        if (!res.ok) throw new Error("Cập nhật đơn hàng thất bại.");

        showToast(`Đã chuyển trạng thái đơn #${orderId} sang ${newStatus}`, 'success');
        
        // Reload table data
        loadOrdersTable();

    } catch (err) {
        showToast(err.message, 'error');
    }
}

// --- VIEW 3: PRODUCTS CRUD MANAGEMENT ---
async function loadProductsTable() {
    try {
        const res = await fetch(`${API_BASE_URL}/products?page=1&pageSize=100`); // Load large list for admin overview
        if (!res.ok) throw new Error("Không thể tải danh sách sản phẩm.");

        const data = await res.json();
        renderProductsTable(data.products);

    } catch (err) {
        showToast(err.message, 'error');
    }
}

function renderProductsTable(products) {
    const tbody = document.getElementById('products-table-body');
    if (!tbody) return;

    if (!products || products.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; color: var(--text-muted);">Không có sản phẩm nào.</td></tr>';
        return;
    }

    tbody.innerHTML = products.map(p => `
        <tr>
            <td><img src="${p.imageUrl}" style="width: 50px; height: 50px; object-fit: cover; border-radius: 6px;" alt=""></td>
            <td style="font-weight: 600;">${p.name}</td>
            <td>${p.categoryId === 1 ? 'Sofa Da' : 'Sofa Nỉ'}</td>
            <td><span style="color: var(--primary);">★</span> ${p.averageRating}</td>
            <td>
                <div style="display: flex; gap: 0.5rem;">
                    <button class="action-btn" onclick="editProduct(${p.id})">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                            <path d="M18.5 2.5a2.121 2.121 0 1 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                        </svg> Sửa
                    </button>
                    <button class="action-btn delete" onclick="deleteProduct(${p.id})">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <polyline points="3 6 5 6 21 6"></polyline>
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                            <line x1="10" y1="11" x2="10" y2="17"></line>
                            <line x1="14" y1="11" x2="14" y2="17"></line>
                        </svg> Xóa
                    </button>
                </div>
            </td>
        </tr>
    `).join('');
}

// Open Product CRUD Editor
let crudMode = 'create'; // 'create' or 'edit'

function openProductCrudModal(mode = 'create') {
    crudMode = mode;
    const modal = document.getElementById('product-crud-modal');
    const title = document.getElementById('crud-modal-title');
    const form = document.getElementById('product-crud-form');
    
    form.reset();
    document.getElementById('crud-product-id').value = '';
    document.getElementById('variants-editor-container').innerHTML = '';

    if (mode === 'create') {
        title.textContent = 'Thêm Sofa Mới';
        // Add one default empty variant row
        addVariantRow();
    } else {
        title.textContent = 'Chỉnh Sửa Sofa';
    }

    modal.classList.add('active');
    document.body.style.overflow = 'hidden';
}

function closeProductCrudModal() {
    const modal = document.getElementById('product-crud-modal');
    modal.classList.remove('active');
    document.body.style.overflow = '';
}

// Add row to variant builder dynamically
function addVariantRow(color = '', material = '', price = '', stock = '') {
    const container = document.getElementById('variants-editor-container');
    const rowId = 'var-row-' + Date.now() + Math.random().toString(36).substr(2, 5);

    const div = document.createElement('div');
    div.className = 'form-variant-row';
    div.id = rowId;
    
    div.innerHTML = `
        <select class="variant-input var-color" required style="max-width: 110px;">
            <option value="Xám" ${color === 'Xám' ? 'selected' : ''}>Xám</option>
            <option value="Nâu" ${color === 'Nâu' ? 'selected' : ''}>Nâu</option>
            <option value="Xanh" ${color === 'Xanh' ? 'selected' : ''}>Xanh</option>
        </select>
        <select class="variant-input var-material" required style="max-width: 110px;">
            <option value="Da bò" ${material === 'Da bò' ? 'selected' : ''}>Da bò</option>
            <option value="Nỉ" ${material === 'Nỉ' ? 'selected' : ''}>Nỉ</option>
        </select>
        <input type="number" class="variant-input var-price" placeholder="Giá tiền (VND)" required min="0" value="${price}">
        <input type="number" class="variant-input var-stock" placeholder="Kho" required min="0" value="${stock}" style="max-width: 80px;">
        <button type="button" class="btn btn-danger" onclick="removeVariantRow('${rowId}')" style="padding: 0.5rem 0.75rem;">×</button>
    `;

    container.appendChild(div);
}

function removeVariantRow(rowId) {
    const row = document.getElementById(rowId);
    if (row) {
        row.remove();
    }
}

// Edit Product: fetch details and fill form
async function editProduct(productId) {
    try {
        const res = await fetch(`${API_BASE_URL}/products/${productId}`);
        if (!res.ok) throw new Error("Không thể lấy dữ liệu sản phẩm.");

        const product = await res.json();
        
        openProductCrudModal('edit');

        document.getElementById('crud-product-id').value = product.id;
        document.getElementById('crud-name').value = product.name;
        document.getElementById('crud-category').value = product.categoryId;
        document.getElementById('crud-image').value = product.imageUrl;
        document.getElementById('crud-desc').value = product.description;

        // Render variants in form
        const container = document.getElementById('variants-editor-container');
        container.innerHTML = ''; // Clear empty initial ones

        product.productVariants.forEach(v => {
            addVariantRow(v.color, v.material, v.price, v.stock);
        });

    } catch (err) {
        showToast(err.message, 'error');
    }
}

// Handle Form Submit (Create / Edit)
async function handleProductSubmit(e) {
    e.preventDefault();

    const productId = document.getElementById('crud-product-id').value;
    const name = document.getElementById('crud-name').value.trim();
    const categoryId = parseInt(document.getElementById('crud-category').value);
    const imageUrl = document.getElementById('crud-image').value.trim();
    const description = document.getElementById('crud-desc').value.trim();

    // Serialize variants builder rows
    const variantRows = document.querySelectorAll('.form-variant-row');
    const variants = [];

    for (let row of variantRows) {
        const color = row.querySelector('.var-color').value;
        const material = row.querySelector('.var-material').value;
        const price = parseFloat(row.querySelector('.var-price').value);
        const stock = parseInt(row.querySelector('.var-stock').value);

        if (isNaN(price) || isNaN(stock)) {
            showToast("Vui lòng nhập giá trị hợp lệ cho các biến thể.", "error");
            return;
        }

        variants.push({ color, material, price, stock });
    }

    if (variants.length === 0) {
        showToast("Vui lòng tạo ít nhất 1 biến thể cho Sofa.", "error");
        return;
    }

    const payload = {
        name,
        description,
        imageUrl,
        categoryId,
        variants
    };

    try {
        let url = `${API_BASE_URL}/products`;
        let method = 'POST';

        if (crudMode === 'edit') {
            url = `${API_BASE_URL}/products/${productId}`;
            method = 'PUT';
        }

        const res = await fetch(url, {
            method,
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(payload)
        });

        const data = await res.json();

        if (!res.ok) {
            throw new Error(data.message || "Lưu sản phẩm thất bại.");
        }

        showToast(crudMode === 'create' ? "Thêm sản phẩm mới thành công!" : "Cập nhật sản phẩm thành công!", "success");
        closeProductCrudModal();
        loadProductsTable(); // Reload table

    } catch (err) {
        showToast(err.message, 'error');
    }
}

// Delete Product (Soft Delete)
async function deleteProduct(productId) {
    if (!confirm("Bạn có chắc chắn muốn xóa sản phẩm Sofa này?")) return;

    try {
        const res = await fetch(`${API_BASE_URL}/products/${productId}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });

        const data = await res.json();

        if (!res.ok) {
            throw new Error(data.message || "Xóa sản phẩm thất bại.");
        }

        showToast("Xóa sản phẩm thành công (Đã xóa mềm)!", "success");
        loadProductsTable(); // Reload products table

    } catch (err) {
        showToast(err.message, 'error');
    }
}

// Admin logout handler
function handleAdminLogout() {
    localStorage.removeItem('sofa_token');
    localStorage.removeItem('sofa_username');
    localStorage.removeItem('sofa_role');
    localStorage.removeItem('sofa_userid');
    window.location.href = 'index.html';
}

// --- UTILS ---
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
