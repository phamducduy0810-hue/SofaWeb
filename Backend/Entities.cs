using System;
using System.Collections.Generic;
using System.Text.Json.Serialization;

namespace SofaECommerce.API.Models
{
    public class Role
    {
        public int Id { get; set; }
        public string Name { get; set; } = string.Empty;
        
        [JsonIgnore]
        public ICollection<User> Users { get; set; } = new List<User>();
    }

    public class User
    {
        public int Id { get; set; }
        public string Username { get; set; } = string.Empty;
        public string Email { get; set; } = string.Empty;
        public string PasswordHash { get; set; } = string.Empty;
        public int RoleId { get; set; }
        public Role? Role { get; set; }
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        public bool IsDeleted { get; set; } = false;

        [JsonIgnore]
        public ICollection<Order> Orders { get; set; } = new List<Order>();
        [JsonIgnore]
        public ICollection<Review> Reviews { get; set; } = new List<Review>();
    }

    public class Category
    {
        public int Id { get; set; }
        public string Name { get; set; } = string.Empty;
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        public bool IsDeleted { get; set; } = false;

        [JsonIgnore]
        public ICollection<Product> Products { get; set; } = new List<Product>();
    }

    public class Product
    {
        public int Id { get; set; }
        public string Name { get; set; } = string.Empty;
        public string Description { get; set; } = string.Empty;
        public string ImageUrl { get; set; } = string.Empty;
        public double AverageRating { get; set; } = 0.0;
        public int CategoryId { get; set; }
        public Category? Category { get; set; }
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        public bool IsDeleted { get; set; } = false;

        public ICollection<ProductVariant> ProductVariants { get; set; } = new List<ProductVariant>();
        public ICollection<Review> Reviews { get; set; } = new List<Review>();
    }

    public class ProductVariant
    {
        public int Id { get; set; }
        public int ProductId { get; set; }
        [JsonIgnore]
        public Product? Product { get; set; }
        public string Color { get; set; } = string.Empty; // Xám, Nâu, Xanh
        public string Material { get; set; } = string.Empty; // Da bò, Nỉ
        public decimal Price { get; set; }
        public int Stock { get; set; }
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        public bool IsDeleted { get; set; } = false;
    }

    public class Coupon
    {
        public int Id { get; set; }
        public string Code { get; set; } = string.Empty;
        public string DiscountType { get; set; } = "Percentage"; // "Percentage" or "Fixed"
        public decimal DiscountValue { get; set; }
        public decimal MaxDiscountAmount { get; set; }
        public decimal MinOrderAmount { get; set; }
        public DateTime ExpiryDate { get; set; }
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        public bool IsDeleted { get; set; } = false;
    }

    public class Order
    {
        public int Id { get; set; }
        public int UserId { get; set; }
        public User? User { get; set; }
        public int? CouponId { get; set; }
        public Coupon? Coupon { get; set; }
        public decimal TotalAmount { get; set; }
        public decimal DiscountAmount { get; set; }
        public decimal FinalAmount { get; set; }
        public string Status { get; set; } = "Pending"; // Pending, Completed, Cancelled
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        public bool IsDeleted { get; set; } = false;

        public ICollection<OrderDetail> OrderDetails { get; set; } = new List<OrderDetail>();
    }

    public class OrderDetail
    {
        public int Id { get; set; }
        public int OrderId { get; set; }
        [JsonIgnore]
        public Order? Order { get; set; }
        public int ProductVariantId { get; set; }
        public ProductVariant? ProductVariant { get; set; }
        public int Quantity { get; set; }
        public decimal UnitPrice { get; set; }
        public decimal TotalPrice { get; set; }
    }

    public class Review
    {
        public int Id { get; set; }
        public int ProductId { get; set; }
        [JsonIgnore]
        public Product? Product { get; set; }
        public int UserId { get; set; }
        public User? User { get; set; }
        public int Rating { get; set; } // 1 to 5
        public string Comment { get; set; } = string.Empty;
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        public bool IsDeleted { get; set; } = false;
    }
}
