using SuperApp.API.Models;

namespace SuperApp.API.Services;

public interface ITokenService
{
    string GenerateToken(User user, List<string> roles);
}
