using Microsoft.EntityFrameworkCore;
using SofaECommerce.API.Models;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Security.Cryptography;
using System.Text;

namespace SofaECommerce.API.Data
{
    public class ApplicationDbContext : DbContext
    {
        public ApplicationDbContext(DbContextOptions<ApplicationDbContext> options) : base(options)
        {
        }

        public DbSet<Role> Roles { get; set; }
        public DbSet<User> Users { get; set; }
        public DbSet<Category> Categories { get; set; }
        public DbSet<Product> Products { get; set; }
        public DbSet<ProductVariant> ProductVariants { get; set; }
        public DbSet<Coupon> Coupons { get; set; }
        public DbSet<Order> Orders { get; set; }
        public DbSet<OrderDetail> OrderDetails { get; set; }
        public DbSet<Review> Reviews { get; set; }

        protected override void OnModelCreating(ModelBuilder modelBuilder)
        {
            base.OnModelCreating(modelBuilder);

            // Primary Keys
            modelBuilder.Entity<Role>().HasKey(r => r.Id);
            modelBuilder.Entity<User>().HasKey(u => u.Id);
            modelBuilder.Entity<Category>().HasKey(c => c.Id);
            modelBuilder.Entity<Product>().HasKey(p => p.Id);
            modelBuilder.Entity<ProductVariant>().HasKey(pv => pv.Id);
            modelBuilder.Entity<Coupon>().HasKey(c => c.Id);
            modelBuilder.Entity<Order>().HasKey(o => o.Id);
            modelBuilder.Entity<OrderDetail>().HasKey(od => od.Id);
            modelBuilder.Entity<Review>().HasKey(r => r.Id);

            // Foreign Keys and Relationships
            modelBuilder.Entity<User>()
                .HasOne(u => u.Role)
                .WithMany(r => r.Users)
                .HasForeignKey(u => u.RoleId)
                .OnDelete(DeleteBehavior.Restrict);

            modelBuilder.Entity<Product>()
                .HasOne(p => p.Category)
                .WithMany(c => c.Products)
                .HasForeignKey(p => p.CategoryId)
                .OnDelete(DeleteBehavior.Restrict);

            modelBuilder.Entity<ProductVariant>()
                .HasOne(pv => pv.Product)
                .WithMany(p => p.ProductVariants)
                .HasForeignKey(pv => pv.ProductId)
                .OnDelete(DeleteBehavior.Cascade);

            modelBuilder.Entity<Review>()
                .HasOne(r => r.Product)
                .WithMany(p => p.Reviews)
                .HasForeignKey(r => r.ProductId)
                .OnDelete(DeleteBehavior.Cascade);

            modelBuilder.Entity<Review>()
                .HasOne(r => r.User)
                .WithMany(u => u.Reviews)
                .HasForeignKey(r => r.UserId)
                .OnDelete(DeleteBehavior.Restrict);

            modelBuilder.Entity<Order>()
                .HasOne(o => o.User)
                .WithMany(u => u.Orders)
                .HasForeignKey(o => o.UserId)
                .OnDelete(DeleteBehavior.Restrict);

            modelBuilder.Entity<Order>()
                .HasOne(o => o.Coupon)
                .WithMany()
                .HasForeignKey(o => o.CouponId)
                .OnDelete(DeleteBehavior.SetNull);

            modelBuilder.Entity<OrderDetail>()
                .HasOne(od => od.Order)
                .WithMany(o => o.OrderDetails)
                .HasForeignKey(od => od.OrderId)
                .OnDelete(DeleteBehavior.Cascade);

            modelBuilder.Entity<OrderDetail>()
                .HasOne(od => od.ProductVariant)
                .WithMany()
                .HasForeignKey(od => od.ProductVariantId)
                .OnDelete(DeleteBehavior.Restrict);

            // Configure Decimal precision for monetary fields
            modelBuilder.Entity<ProductVariant>()
                .Property(pv => pv.Price)
                .HasPrecision(18, 2);

            modelBuilder.Entity<Coupon>()
                .Property(c => c.DiscountValue)
                .HasPrecision(18, 2);

            modelBuilder.Entity<Coupon>()
                .Property(c => c.MaxDiscountAmount)
                .HasPrecision(18, 2);

            modelBuilder.Entity<Coupon>()
                .Property(c => c.MinOrderAmount)
                .HasPrecision(18, 2);

            modelBuilder.Entity<Order>()
                .Property(o => o.TotalAmount)
                .HasPrecision(18, 2);

            modelBuilder.Entity<Order>()
                .Property(o => o.DiscountAmount)
                .HasPrecision(18, 2);

            modelBuilder.Entity<Order>()
                .Property(o => o.FinalAmount)
                .HasPrecision(18, 2);

            modelBuilder.Entity<OrderDetail>()
                .Property(od => od.UnitPrice)
                .HasPrecision(18, 2);

            modelBuilder.Entity<OrderDetail>()
                .Property(od => od.TotalPrice)
                .HasPrecision(18, 2);

            // Global Query Filters (Soft-Delete)
            modelBuilder.Entity<User>().HasQueryFilter(u => !u.IsDeleted);
            modelBuilder.Entity<Category>().HasQueryFilter(c => !c.IsDeleted);
            modelBuilder.Entity<Product>().HasQueryFilter(p => !p.IsDeleted);
            modelBuilder.Entity<ProductVariant>().HasQueryFilter(pv => !pv.IsDeleted);
            modelBuilder.Entity<Coupon>().HasQueryFilter(c => !c.IsDeleted);
            modelBuilder.Entity<Order>().HasQueryFilter(o => !o.IsDeleted);
            modelBuilder.Entity<Review>().HasQueryFilter(r => !r.IsDeleted);
        }

        public void SeedData()
        {
            // Check if Roles exist
            if (!Roles.Any())
            {
                var adminRole = new Role { Id = 1, Name = "Admin" };
                var customerRole = new Role { Id = 2, Name = "Customer" };
                
                Roles.AddRange(adminRole, customerRole);
                SaveChanges();
            }

            // Check if Users exist
            if (!Users.Any())
            {
                var adminUser = new User
                {
                    Id = 1,
                    Username = "admin",
                    Email = "admin@sofa.com",
                    PasswordHash = HashPassword("AdminPassword"),
                    RoleId = 1,
                    CreatedAt = DateTime.UtcNow,
                    IsDeleted = false
                };

                var customer1 = new User
                {
                    Id = 2,
                    Username = "customer1",
                    Email = "customer1@gmail.com",
                    PasswordHash = HashPassword("UserPassword1"),
                    RoleId = 2,
                    CreatedAt = DateTime.UtcNow,
                    IsDeleted = false
                };

                var customer2 = new User
                {
                    Id = 3,
                    Username = "customer2",
                    Email = "customer2@gmail.com",
                    PasswordHash = HashPassword("UserPassword2"),
                    RoleId = 2,
                    CreatedAt = DateTime.UtcNow,
                    IsDeleted = false
                };

                Users.AddRange(adminUser, customer1, customer2);
                SaveChanges();
            }

            // Check if Categories exist
            if (!Categories.Any())
            {
                var catLeather = new Category { Id = 1, Name = "Sofa Da", CreatedAt = DateTime.UtcNow };
                var catFabric = new Category { Id = 2, Name = "Sofa Nỉ", CreatedAt = DateTime.UtcNow };

                Categories.AddRange(catLeather, catFabric);
                SaveChanges();
            }

            // Check if Products exist
            if (!Products.Any())
            {
                var products = new List<Product>
                {
                    new Product
                    {
                        Id = 1,
                        Name = "Sofa Da Bò Luxury",
                        Description = "Sofa làm bằng da bò cao cấp nhập khẩu từ Ý, mang lại sự sang trọng và thoải mái tối đa.",
                        ImageUrl = "https://images.unsplash.com/photo-1555041469-a586c61ea9bc?auto=format&fit=crop&q=80&w=600",
                        AverageRating = 4.67,
                        CategoryId = 1,
                        CreatedAt = DateTime.UtcNow
                    },
                    new Product
                    {
                        Id = 2,
                        Name = "Sofa Băng Nỉ Hiện Đại",
                        Description = "Thiết kế hiện đại, trẻ trung phù hợp với chung cư, chất liệu nỉ êm ái thoáng mát.",
                        ImageUrl = "https://images.unsplash.com/photo-1493663284031-b7e3aefcae8e?auto=format&fit=crop&q=80&w=600",
                        AverageRating = 5.0,
                        CategoryId = 2,
                        CreatedAt = DateTime.UtcNow
                    },
                    new Product
                    {
                        Id = 3,
                        Name = "Sofa Góc Chữ L Cao Cấp",
                        Description = "Kiểu dáng chữ L tiện lợi, chất liệu da thật bóng bẩy dễ vệ sinh.",
                        ImageUrl = "https://images.unsplash.com/photo-1540518614846-7eded433c457?auto=format&fit=crop&q=80&w=600",
                        AverageRating = 0.0,
                        CategoryId = 1,
                        CreatedAt = DateTime.UtcNow
                    },
                    new Product
                    {
                        Id = 4,
                        Name = "Sofa Giường Đa Năng",
                        Description = "Tích hợp 2 trong 1 vừa làm sofa tiếp khách vừa kéo ra làm giường ngủ êm ái.",
                        ImageUrl = "https://images.unsplash.com/photo-1586023492125-27b2c045efd7?auto=format&fit=crop&q=80&w=600",
                        AverageRating = 0.0,
                        CategoryId = 2,
                        CreatedAt = DateTime.UtcNow
                    },
                    new Product
                    {
                        Id = 5,
                        Name = "Sofa Đơn Thư Giãn Royal",
                        Description = "Sofa đơn xoay 360 độ cao cấp cho phòng đọc sách hoặc thư phòng.",
                        ImageUrl = "https://images.unsplash.com/photo-1567538096630-e0c55bd6374c?auto=format&fit=crop&q=80&w=600",
                        AverageRating = 0.0,
                        CategoryId = 1,
                        CreatedAt = DateTime.UtcNow
                    }
                };

                Products.AddRange(products);
                SaveChanges();

                var variants = new List<ProductVariant>
                {
                    // Variants for Product 1
                    new ProductVariant { Id = 1, ProductId = 1, Color = "Nâu", Material = "Da bò", Price = 45000000m, Stock = 10, CreatedAt = DateTime.UtcNow },
                    new ProductVariant { Id = 2, ProductId = 1, Color = "Xám", Material = "Da bò", Price = 47000000m, Stock = 5, CreatedAt = DateTime.UtcNow },
                    
                    // Variants for Product 2
                    new ProductVariant { Id = 3, ProductId = 2, Color = "Xanh", Material = "Nỉ", Price = 15000000m, Stock = 15, CreatedAt = DateTime.UtcNow },
                    new ProductVariant { Id = 4, ProductId = 2, Color = "Xám", Material = "Nỉ", Price = 15000000m, Stock = 12, CreatedAt = DateTime.UtcNow },
                    
                    // Variants for Product 3
                    new ProductVariant { Id = 5, ProductId = 3, Color = "Nâu", Material = "Da bò", Price = 38000000m, Stock = 8, CreatedAt = DateTime.UtcNow },
                    new ProductVariant { Id = 6, ProductId = 3, Color = "Xám", Material = "Da bò", Price = 39000000m, Stock = 4, CreatedAt = DateTime.UtcNow },

                    // Variants for Product 4
                    new ProductVariant { Id = 7, ProductId = 4, Color = "Xám", Material = "Nỉ", Price = 12000000m, Stock = 20, CreatedAt = DateTime.UtcNow },
                    new ProductVariant { Id = 8, ProductId = 4, Color = "Nâu", Material = "Nỉ", Price = 12500000m, Stock = 10, CreatedAt = DateTime.UtcNow },

                    // Variants for Product 5
                    new ProductVariant { Id = 9, ProductId = 5, Color = "Xanh", Material = "Da bò", Price = 8000000m, Stock = 5, CreatedAt = DateTime.UtcNow },
                    new ProductVariant { Id = 10, ProductId = 5, Color = "Nâu", Material = "Da bò", Price = 8500000m, Stock = 8, CreatedAt = DateTime.UtcNow }
                };

                ProductVariants.AddRange(variants);
                SaveChanges();
            }

            // Check if Coupons exist
            if (!Coupons.Any())
            {
                var coupons = new List<Coupon>
                {
                    new Coupon
                    {
                        Id = 1,
                        Code = "SOFAWELCOME",
                        DiscountType = "Percentage",
                        DiscountValue = 10m,
                        MinOrderAmount = 10000000m,
                        MaxDiscountAmount = 2000000m,
                        ExpiryDate = DateTime.UtcNow.AddDays(30),
                        CreatedAt = DateTime.UtcNow
                    },
                    new Coupon
                    {
                        Id = 2,
                        Code = "SOFAVIP5M",
                        DiscountType = "Fixed",
                        DiscountValue = 5000000m,
                        MinOrderAmount = 40000000m,
                        MaxDiscountAmount = 5000000m,
                        ExpiryDate = DateTime.UtcNow.AddDays(30),
                        CreatedAt = DateTime.UtcNow
                    }
                };

                Coupons.AddRange(coupons);
                SaveChanges();
            }

            // Check if Reviews exist
            if (!Reviews.Any())
            {
                var reviews = new List<Review>
                {
                    new Review
                    {
                        Id = 1,
                        ProductId = 1,
                        UserId = 2,
                        Rating = 5,
                        Comment = "Sofa da bò cực kỳ sang trọng, ngồi êm và da mềm lắm!",
                        CreatedAt = DateTime.UtcNow
                    },
                    new Review
                    {
                        Id = 2,
                        ProductId = 1,
                        UserId = 3,
                        Rating = 4,
                        Comment = "Đẹp nhưng giao hàng hơi chậm một tí. Sofa chất lượng.",
                        CreatedAt = DateTime.UtcNow
                    },
                    new Review
                    {
                        Id = 3,
                        ProductId = 2,
                        UserId = 2,
                        Rating = 5,
                        Comment = "Sofa nỉ rất thoáng mát, màu xanh đẹp đúng như hình.",
                        CreatedAt = DateTime.UtcNow
                    }
                };

                Reviews.AddRange(reviews);
                SaveChanges();
            }
        }

        public static string HashPassword(string password)
        {
            using (var sha256 = System.Security.Cryptography.SHA256.Create())
            {
                var hashedBytes = sha256.ComputeHash(System.Text.Encoding.UTF8.GetBytes(password));
                return Convert.ToBase64String(hashedBytes);
            }
        }
    }
}
