using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using SofaECommerce.API.Data;
using SofaECommerce.API.Models;
using System;
using System.Collections.Generic;
using System.IdentityModel.Tokens.Jwt;
using System.Linq;
using System.Security.Claims;
using System.Text;
using System.Threading.Tasks;

namespace SofaECommerce.API.Controllers
{
    // --- AUTHENTICATION CONTROLLER ---
    [ApiController]
    [Route("api/auth")]
    public class AuthenticationController : ControllerBase
    {
        private readonly ApplicationDbContext _context;
        private readonly IConfiguration _configuration;

        public AuthenticationController(ApplicationDbContext context, IConfiguration configuration)
        {
            _context = context;
            _configuration = configuration;
        }

        [HttpPost("register")]
        public async Task<IActionResult> Register([FromBody] RegisterDto dto)
        {
            if (await _context.Users.AnyAsync(u => u.Username == dto.Username))
                return BadRequest(new { message = "Username already exists." });

            if (await _context.Users.AnyAsync(u => u.Email == dto.Email))
                return BadRequest(new { message = "Email already exists." });

            var customerRole = await _context.Roles.FirstOrDefaultAsync(r => r.Name == "Customer");
            if (customerRole == null)
            {
                customerRole = new Role { Name = "Customer" };
                _context.Roles.Add(customerRole);
                await _context.SaveChangesAsync();
            }

            var user = new User
            {
                Username = dto.Username,
                Email = dto.Email,
                PasswordHash = ApplicationDbContext.HashPassword(dto.Password),
                RoleId = customerRole.Id,
                CreatedAt = DateTime.UtcNow,
                IsDeleted = false
            };

            _context.Users.Add(user);
            await _context.SaveChangesAsync();

            return Ok(new { message = "Registration successful." });
        }

        [HttpPost("login")]
        public async Task<IActionResult> Login([FromBody] LoginDto dto)
        {
            var user = await _context.Users
                .Include(u => u.Role)
                .FirstOrDefaultAsync(u => u.Username == dto.Username);

            if (user == null)
                return Unauthorized(new { message = "Invalid username or password." });

            var hashedInput = ApplicationDbContext.HashPassword(dto.Password);
            if (user.PasswordHash != hashedInput)
                return Unauthorized(new { message = "Invalid username or password." });

            var token = GenerateJwtToken(user);

            return Ok(new AuthResponseDto
            {
                Token = token,
                Username = user.Username,
                Role = user.Role?.Name ?? "Customer",
                UserId = user.Id
            });
        }

        private string GenerateJwtToken(User user)
        {
            var tokenHandler = new JwtSecurityTokenHandler();
            var jwtKey = _configuration["Jwt:Key"] ?? "SuperSecretKeyForSofaECommerceApp2026!";
            var key = Encoding.ASCII.GetBytes(jwtKey);
            
            var tokenDescriptor = new SecurityTokenDescriptor
            {
                Subject = new ClaimsIdentity(new[]
                {
                    new Claim(ClaimTypes.NameIdentifier, user.Id.ToString()),
                    new Claim(ClaimTypes.Name, user.Username),
                    new Claim(ClaimTypes.Role, user.Role?.Name ?? "Customer")
                }),
                Expires = DateTime.UtcNow.AddDays(7),
                SigningCredentials = new SigningCredentials(new SymmetricSecurityKey(key), SecurityAlgorithms.HmacSha256Signature),
                Issuer = _configuration["Jwt:Issuer"] ?? "SofaECommerce",
                Audience = _configuration["Jwt:Audience"] ?? "SofaECommerce"
            };

            var token = tokenHandler.CreateToken(tokenDescriptor);
            return tokenHandler.WriteToken(token);
        }
    }

    // --- PRODUCT CONTROLLER ---
    [ApiController]
    [Route("api/products")]
    public class ProductController : ControllerBase
    {
        private readonly ApplicationDbContext _context;

        public ProductController(ApplicationDbContext context)
        {
            _context = context;
        }

        // GET all products with filtering, search, pagination
        [HttpGet]
        public async Task<IActionResult> GetProducts(
            [FromQuery] string? search,
            [FromQuery] int? categoryId,
            [FromQuery] decimal? minPrice,
            [FromQuery] decimal? maxPrice,
            [FromQuery] int page = 1,
            [FromQuery] int pageSize = 6)
        {
            var query = _context.Products
                .Include(p => p.Category)
                .Include(p => p.ProductVariants)
                .AsQueryable();

            // Search Filter (for Debounce search)
            if (!string.IsNullOrWhiteSpace(search))
            {
                var searchLower = search.ToLower();
                query = query.Where(p => p.Name.ToLower().Contains(searchLower) || p.Description.ToLower().Contains(searchLower));
            }

            // Category Filter
            if (categoryId.HasValue)
            {
                query = query.Where(p => p.CategoryId == categoryId.Value);
            }

            // Price Filter (based on variant prices)
            if (minPrice.HasValue)
            {
                query = query.Where(p => p.ProductVariants.Any(v => v.Price >= minPrice.Value));
            }

            if (maxPrice.HasValue)
            {
                query = query.Where(p => p.ProductVariants.Any(v => v.Price <= maxPrice.Value));
            }

            var totalItems = await query.CountAsync();
            var totalPages = (int)Math.Ceiling((double)totalItems / pageSize);

            var products = await query
                .OrderByDescending(p => p.CreatedAt)
                .Skip((page - 1) * pageSize)
                .Take(pageSize)
                .ToListAsync();

            return Ok(new
            {
                products,
                page,
                pageSize,
                totalPages,
                totalItems
            });
        }

        // GET details of a single product
        [HttpGet("{id}")]
        public async Task<IActionResult> GetProductById(int id)
        {
            var product = await _context.Products
                .Include(p => p.Category)
                .Include(p => p.ProductVariants)
                .Include(p => p.Reviews)
                    .ThenInclude(r => r.User)
                .FirstOrDefaultAsync(p => p.Id == id);

            if (product == null)
                return NotFound(new { message = "Product not found." });

            return Ok(product);
        }

        // Content-based recommendation endpoint
        [HttpGet("recommendations")]
        public async Task<IActionResult> GetRecommendations([FromQuery] string? categoryIds)
        {
            if (string.IsNullOrEmpty(categoryIds))
            {
                // Fallback: return top rated products
                var fallbackProducts = await _context.Products
                    .Include(p => p.ProductVariants)
                    .OrderByDescending(p => p.AverageRating)
                    .Take(4)
                    .ToListAsync();
                return Ok(fallbackProducts);
            }

            var ids = categoryIds.Split(',')
                .Select(idStr => int.TryParse(idStr, out var id) ? id : 0)
                .Where(id => id > 0)
                .ToList();

            if (!ids.Any())
            {
                var fallbackProducts = await _context.Products
                    .Include(p => p.ProductVariants)
                    .OrderByDescending(p => p.AverageRating)
                    .Take(4)
                    .ToListAsync();
                return Ok(fallbackProducts);
            }

            // Filter products matching the viewed categories
            var recommendedProducts = await _context.Products
                .Include(p => p.ProductVariants)
                .Where(p => ids.Contains(p.CategoryId))
                .OrderByDescending(p => p.AverageRating)
                .Take(4)
                .ToListAsync();

            // If we don't have enough recommendations, pad with top products
            if (recommendedProducts.Count < 4)
            {
                var existingIds = recommendedProducts.Select(p => p.Id).ToList();
                var additional = await _context.Products
                    .Include(p => p.ProductVariants)
                    .Where(p => !existingIds.Contains(p.Id))
                    .OrderByDescending(p => p.AverageRating)
                    .Take(4 - recommendedProducts.Count)
                    .ToListAsync();
                recommendedProducts.AddRange(additional);
            }

            return Ok(recommendedProducts);
        }

        // POST Review (Must have purchased the product successfully)
        [HttpPost("{id}/reviews")]
        [Authorize]
        public async Task<IActionResult> AddReview(int id, [FromBody] ReviewDto dto)
        {
            var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier);
            if (userIdClaim == null) return Unauthorized();
            int userId = int.Parse(userIdClaim.Value);

            // Verify if product exists
            var product = await _context.Products.FindAsync(id);
            if (product == null) return NotFound(new { message = "Product not found." });

            // Check if user has bought any variant of this product in a Completed order
            var hasPurchased = await _context.Orders
                .Where(o => o.UserId == userId && o.Status == "Completed")
                .AnyAsync(o => o.OrderDetails.Any(od => od.ProductVariant != null && od.ProductVariant.ProductId == id));

            if (!hasPurchased)
            {
                return BadRequest(new { message = "You can only review products you have successfully purchased." });
            }

            // Create Review
            var review = new Review
            {
                ProductId = id,
                UserId = userId,
                Rating = dto.Rating,
                Comment = dto.Comment,
                CreatedAt = DateTime.UtcNow
            };

            _context.Reviews.Add(review);
            await _context.SaveChangesAsync();

            // Recalculate average rating
            var reviews = await _context.Reviews.Where(r => r.ProductId == id).ToListAsync();
            product.AverageRating = Math.Round(reviews.Average(r => r.Rating), 2);
            await _context.SaveChangesAsync();

            return Ok(new { message = "Review added successfully.", averageRating = product.AverageRating });
        }

        // --- ADMIN CRUD ENDPOINTS ---

        [HttpPost]
        [Authorize(Roles = "Admin")]
        public async Task<IActionResult> CreateProduct([FromBody] ProductCreateDto dto)
        {
            var product = new Product
            {
                Name = dto.Name,
                Description = dto.Description,
                ImageUrl = dto.ImageUrl,
                CategoryId = dto.CategoryId,
                CreatedAt = DateTime.UtcNow,
                IsDeleted = false
            };

            _context.Products.Add(product);
            await _context.SaveChangesAsync(); // Generates Product Id

            foreach (var v in dto.Variants)
            {
                var variant = new ProductVariant
                {
                    ProductId = product.Id,
                    Color = v.Color,
                    Material = v.Material,
                    Price = v.Price,
                    Stock = v.Stock,
                    CreatedAt = DateTime.UtcNow,
                    IsDeleted = false
                };
                _context.ProductVariants.Add(variant);
            }

            await _context.SaveChangesAsync();
            return CreatedAtAction(nameof(GetProductById), new { id = product.Id }, product);
        }

        [HttpPut("{id}")]
        [Authorize(Roles = "Admin")]
        public async Task<IActionResult> UpdateProduct(int id, [FromBody] ProductCreateDto dto)
        {
            var product = await _context.Products
                .Include(p => p.ProductVariants)
                .FirstOrDefaultAsync(p => p.Id == id);

            if (product == null) return NotFound(new { message = "Product not found." });

            product.Name = dto.Name;
            product.Description = dto.Description;
            product.ImageUrl = dto.ImageUrl;
            product.CategoryId = dto.CategoryId;

            // Remove old variants
            _context.ProductVariants.RemoveRange(product.ProductVariants);

            // Add new variants
            foreach (var v in dto.Variants)
            {
                var variant = new ProductVariant
                {
                    ProductId = product.Id,
                    Color = v.Color,
                    Material = v.Material,
                    Price = v.Price,
                    Stock = v.Stock,
                    CreatedAt = DateTime.UtcNow,
                    IsDeleted = false
                };
                _context.ProductVariants.Add(variant);
            }

            await _context.SaveChangesAsync();
            return Ok(new { message = "Product updated successfully." });
        }

        [HttpDelete("{id}")]
        [Authorize(Roles = "Admin")]
        public async Task<IActionResult> DeleteProduct(int id)
        {
            var product = await _context.Products.FindAsync(id);
            if (product == null) return NotFound(new { message = "Product not found." });

            product.IsDeleted = true; // Soft Delete
            
            // Soft delete variants too
            var variants = await _context.ProductVariants.Where(v => v.ProductId == id).ToListAsync();
            foreach (var v in variants)
            {
                v.IsDeleted = true;
            }

            await _context.SaveChangesAsync();
            return Ok(new { message = "Product deleted successfully." });
        }
    }

    // --- ORDER CONTROLLER (WITH TRANSACTIONS & AUTO-APPLY COUPON) ---
    [ApiController]
    [Route("api/orders")]
    public class OrderController : ControllerBase
    {
        private readonly ApplicationDbContext _context;

        public OrderController(ApplicationDbContext context)
        {
            _context = context;
        }

        [HttpGet("coupons")]
        [AllowAnonymous]
        public async Task<IActionResult> GetActiveCoupons()
        {
            var currentDate = DateTime.UtcNow;
            var coupons = await _context.Coupons
                .Where(c => c.ExpiryDate > currentDate)
                .ToListAsync();
            return Ok(coupons);
        }

        [HttpGet]
        [Authorize(Roles = "Admin")]
        public async Task<IActionResult> GetAllOrders()
        {
            var orders = await _context.Orders
                .Include(o => o.User)
                .Include(o => o.Coupon)
                .Include(o => o.OrderDetails)
                    .ThenInclude(od => od.ProductVariant)
                        .ThenInclude(pv => pv.Product)
                .OrderByDescending(o => o.CreatedAt)
                .ToListAsync();

            return Ok(orders);
        }

        [HttpPut("{id}/status")]
        [Authorize(Roles = "Admin")]
        public async Task<IActionResult> UpdateOrderStatus(int id, [FromBody] UpdateStatusDto dto)
        {
            var order = await _context.Orders.FindAsync(id);
            if (order == null) return NotFound(new { message = "Order not found." });

            order.Status = dto.Status;
            await _context.SaveChangesAsync();
            return Ok(new { message = "Order status updated successfully." });
        }

        [HttpPost("checkout")]
        [Authorize]
        public async Task<IActionResult> Checkout([FromBody] OrderDto dto)
        {
            var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier);
            if (userIdClaim == null) return Unauthorized();
            int userId = int.Parse(userIdClaim.Value);

            if (dto.OrderDetails == null || !dto.OrderDetails.Any())
            {
                return BadRequest(new { message = "Cart cannot be empty." });
            }

            // Begin Database Transaction
            using (var transaction = await _context.Database.BeginTransactionAsync())
            {
                try
                {
                    decimal subtotal = 0m;
                    var detailsToCreate = new List<OrderDetail>();

                    // 1. Calculate original total and check stock
                    foreach (var item in dto.OrderDetails)
                    {
                        var variant = await _context.ProductVariants
                            .Include(pv => pv.Product)
                            .FirstOrDefaultAsync(pv => pv.Id == item.ProductVariantId);

                        if (variant == null)
                        {
                            throw new Exception($"Product variant with ID {item.ProductVariantId} not found.");
                        }

                        if (variant.Stock < item.Quantity)
                        {
                            throw new Exception($"Insufficient stock for {variant.Product?.Name} ({variant.Color}, {variant.Material}). Available: {variant.Stock}, Requested: {item.Quantity}");
                        }

                        // Deduct Stock
                        variant.Stock -= item.Quantity;
                        _context.Entry(variant).State = EntityState.Modified;

                        var itemTotal = variant.Price * item.Quantity;
                        subtotal += itemTotal;

                        detailsToCreate.Add(new OrderDetail
                        {
                            ProductVariantId = variant.Id,
                            Quantity = item.Quantity,
                            UnitPrice = variant.Price,
                            TotalPrice = itemTotal
                        });
                    }

                    // 2. Auto-Apply Coupon System (Find best valid coupon)
                    var currentDate = DateTime.UtcNow;
                    var activeCoupons = await _context.Coupons
                        .Where(c => c.ExpiryDate > currentDate)
                        .ToListAsync();

                    Coupon? bestCoupon = null;
                    decimal maxDiscount = 0m;

                    foreach (var coupon in activeCoupons)
                    {
                        if (subtotal >= coupon.MinOrderAmount)
                        {
                            decimal discount = 0m;
                            if (coupon.DiscountType.Equals("Percentage", StringComparison.OrdinalIgnoreCase))
                            {
                                discount = subtotal * (coupon.DiscountValue / 100m);
                                if (discount > coupon.MaxDiscountAmount)
                                {
                                    discount = coupon.MaxDiscountAmount;
                                }
                            }
                            else if (coupon.DiscountType.Equals("Fixed", StringComparison.OrdinalIgnoreCase))
                            {
                                discount = coupon.DiscountValue;
                            }

                            if (discount > maxDiscount)
                            {
                                maxDiscount = discount;
                                bestCoupon = coupon;
                            }
                        }
                    }

                    decimal finalAmount = subtotal - maxDiscount;
                    if (finalAmount < 0) finalAmount = 0m;

                    // 3. Create Order Entity
                    var order = new Order
                    {
                        UserId = userId,
                        CouponId = bestCoupon?.Id,
                        TotalAmount = subtotal,
                        DiscountAmount = maxDiscount,
                        FinalAmount = finalAmount,
                        Status = "Completed", // Auto-complete for instant testing/demonstration
                        CreatedAt = DateTime.UtcNow,
                        IsDeleted = false
                    };

                    _context.Orders.Add(order);
                    await _context.SaveChangesAsync(); // Generate OrderId

                    // 4. Assign OrderId to details and save
                    foreach (var detail in detailsToCreate)
                    {
                        detail.OrderId = order.Id;
                        _context.OrderDetails.Add(detail);
                    }

                    await _context.SaveChangesAsync();

                    // 5. Commit Transaction
                    await transaction.CommitAsync();

                    return Ok(new
                    {
                        message = "Checkout successful.",
                        orderId = order.Id,
                        subtotal,
                        discount = maxDiscount,
                        finalAmount,
                        appliedCoupon = bestCoupon?.Code
                    });
                }
                catch (Exception ex)
                {
                    // Rollback Transaction in case of any exceptions
                    await transaction.RollbackAsync();
                    return BadRequest(new { message = ex.Message });
                }
            }
        }
    }

    // --- DASHBOARD CONTROLLER (ADMIN ANALYTICS - JOIN & GROUP BY) ---
    [ApiController]
    [Route("api/dashboard")]
    [Authorize(Roles = "Admin")]
    public class DashboardController : ControllerBase
    {
        private readonly ApplicationDbContext _context;

        public DashboardController(ApplicationDbContext context)
        {
            _context = context;
        }

        [HttpGet("stats")]
        public async Task<IActionResult> GetStats()
        {
            // 1. Total Revenue (Completed Orders)
            var totalRevenue = await _context.Orders
                .Where(o => o.Status == "Completed")
                .SumAsync(o => o.FinalAmount);

            // 2. Success/Cancelled Ratio
            var totalOrdersCount = await _context.Orders.CountAsync();
            var successOrdersCount = await _context.Orders.CountAsync(o => o.Status == "Completed");
            var cancelledOrdersCount = await _context.Orders.CountAsync(o => o.Status == "Cancelled");
            var pendingOrdersCount = await _context.Orders.CountAsync(o => o.Status == "Pending");

            // 3. Top 3 Best Selling Sofa Products using JOIN and GROUP BY
            // LINQ query translates to a SQL JOIN and GROUP BY
            var top3Products = await _context.OrderDetails
                .Include(od => od.ProductVariant)
                    .ThenInclude(pv => pv.Product)
                .Where(od => od.Order != null && od.Order.Status == "Completed")
                .GroupBy(od => new
                {
                    ProductId = od.ProductVariant.Product.Id,
                    ProductName = od.ProductVariant.Product.Name,
                    ImageUrl = od.ProductVariant.Product.ImageUrl
                })
                .Select(g => new TopProductDto
                {
                    ProductId = g.Key.ProductId,
                    ProductName = g.Key.ProductName,
                    ImageUrl = g.Key.ImageUrl,
                    TotalQuantitySold = g.Sum(od => od.Quantity),
                    TotalRevenueGenerated = g.Sum(od => od.TotalPrice)
                })
                .OrderByDescending(p => p.TotalQuantitySold)
                .Take(3)
                .ToListAsync();

            return Ok(new
            {
                totalRevenue,
                totalOrdersCount,
                successOrdersCount,
                cancelledOrdersCount,
                pendingOrdersCount,
                successRate = totalOrdersCount > 0 ? Math.Round((double)successOrdersCount / totalOrdersCount * 100, 2) : 0,
                cancelledRate = totalOrdersCount > 0 ? Math.Round((double)cancelledOrdersCount / totalOrdersCount * 100, 2) : 0,
                topProducts = top3Products
            });
        }
    }

    // --- DTO CLASSES ---
    public class RegisterDto
    {
        public string Username { get; set; } = string.Empty;
        public string Email { get; set; } = string.Empty;
        public string Password { get; set; } = string.Empty;
    }

    public class LoginDto
    {
        public string Username { get; set; } = string.Empty;
        public string Password { get; set; } = string.Empty;
    }

    public class AuthResponseDto
    {
        public string Token { get; set; } = string.Empty;
        public string Username { get; set; } = string.Empty;
        public string Role { get; set; } = string.Empty;
        public int UserId { get; set; }
    }

    public class ProductCreateDto
    {
        public string Name { get; set; } = string.Empty;
        public string Description { get; set; } = string.Empty;
        public string ImageUrl { get; set; } = string.Empty;
        public int CategoryId { get; set; }
        public List<VariantDto> Variants { get; set; } = new List<VariantDto>();
    }

    public class VariantDto
    {
        public string Color { get; set; } = string.Empty;
        public string Material { get; set; } = string.Empty;
        public decimal Price { get; set; }
        public int Stock { get; set; }
    }

    public class OrderDto
    {
        public List<OrderItemDto> OrderDetails { get; set; } = new List<OrderItemDto>();
    }

    public class OrderItemDto
    {
        public int ProductVariantId { get; set; }
        public int Quantity { get; set; }
    }

    public class ReviewDto
    {
        public int Rating { get; set; }
        public string Comment { get; set; } = string.Empty;
    }

    public class UpdateStatusDto
    {
        public string Status { get; set; } = string.Empty;
    }

    public class TopProductDto
    {
        public int ProductId { get; set; }
        public string ProductName { get; set; } = string.Empty;
        public string ImageUrl { get; set; } = string.Empty;
        public int TotalQuantitySold { get; set; }
        public decimal TotalRevenueGenerated { get; set; }
    }
}
