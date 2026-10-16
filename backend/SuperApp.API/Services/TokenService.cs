using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using Microsoft.Extensions.Configuration;
using Microsoft.IdentityModel.Tokens;
using SuperApp.API.Models;

namespace SuperApp.API.Services;

public class TokenService : ITokenService
{
    private readonly IConfiguration _config;

    public TokenService(IConfiguration config)
    {
        _config = config;
    }

    public string GenerateToken(User user, List<string> roles)
    {
        var claims = new List<Claim>
        {
            new Claim(ClaimTypes.NameIdentifier, user.Id.ToString()),
            new Claim(ClaimTypes.MobilePhone, user.MobileNumber),
            new Claim(ClaimTypes.Name, user.FullName ?? string.Empty),
        };

        foreach (var role in roles)
        {
            claims.Add(new Claim(ClaimTypes.Role, role));
        }

        var secret = Environment.GetEnvironmentVariable("JWT_SECRET")
            ?? _config["Jwt:Secret"]
            ?? "SuperApp_Development_Secret_Key_2026_Must_Be_At_Least_32_Characters";

        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(secret));
        
        var creds = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);

        var issuer = Environment.GetEnvironmentVariable("JWT_ISSUER") ?? _config["Jwt:Issuer"] ?? "SuperApp";
        var audience = Environment.GetEnvironmentVariable("JWT_AUDIENCE") ?? _config["Jwt:Audience"] ?? "SuperApp";

        var token = new JwtSecurityToken(
            issuer: issuer,
            audience: audience,
            claims: claims,
            expires: DateTime.UtcNow.AddDays(30),
            signingCredentials: creds
        );

        return new JwtSecurityTokenHandler().WriteToken(token);
    }
}
