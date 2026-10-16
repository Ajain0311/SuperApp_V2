namespace SuperApp.API.DTOs;

public class PushDispatchResult
{
    public bool IsSuccess { get; set; }
    public bool IsBlocked { get; set; }
    public string Status { get; set; } = string.Empty;
    public string Message { get; set; } = string.Empty;
    public int CaptainsFound { get; set; }
    public int TokensAttempted { get; set; }
    public int TokensSucceeded { get; set; }
    public int TokensFailed { get; set; }
    public int TokensPruned { get; set; }

    public static PushDispatchResult Blocked(string reason, int captainsFound = 0, int tokensAttempted = 0) => new()
    {
        IsSuccess = false,
        IsBlocked = true,
        Status = "BLOCKED — credentials required",
        Message = reason,
        CaptainsFound = captainsFound,
        TokensAttempted = tokensAttempted
    };

    public static PushDispatchResult Success(int captainsFound, int tokensAttempted, int tokensSucceeded, int tokensFailed, int tokensPruned, string message = "Dispatched") => new()
    {
        IsSuccess = true,
        IsBlocked = false,
        Status = "SUCCESS",
        Message = message,
        CaptainsFound = captainsFound,
        TokensAttempted = tokensAttempted,
        TokensSucceeded = tokensSucceeded,
        TokensFailed = tokensFailed,
        TokensPruned = tokensPruned
    };

    public static PushDispatchResult NoCaptains(string message = "No registered captains with active device tokens found") => new()
    {
        IsSuccess = true,
        IsBlocked = false,
        Status = "NO_RECIPIENTS",
        Message = message,
        CaptainsFound = 0,
        TokensAttempted = 0
    };
}
