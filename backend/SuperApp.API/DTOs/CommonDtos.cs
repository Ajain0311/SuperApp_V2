namespace SuperApp.API.DTOs;

public class ApiResponse<T>
{
    public bool Success { get; set; }
    public string Message { get; set; } = string.Empty;
    public T? Data { get; set; }
    
    public static ApiResponse<T> Ok(T data, string message = "Success")
        => new() { Success = true, Message = message, Data = data };
    
    public static ApiResponse<T> Fail(string message)
        => new() { Success = false, Message = message };
}

public class ApiResponse
{
    public bool Success { get; set; }
    public string Message { get; set; } = string.Empty;
    
    public static ApiResponse Ok(string message = "Success")
        => new() { Success = true, Message = message };
    
    public static ApiResponse Fail(string message)
        => new() { Success = false, Message = message };
}

public class PagedResult<T>
{
    public List<T> Items { get; set; } = new();
    public int TotalCount { get; set; }
    public int Page { get; set; }
    public int PageSize { get; set; }
    public int TotalPages => (int)Math.Ceiling((double)TotalCount / PageSize);
    public bool HasNext => Page < TotalPages;
    public bool HasPrevious => Page > 1;
}

public class ActionRequest
{
    public string Action { get; set; } = string.Empty; // ADD, EDIT, DELETE, STATUS
}

public class RegisterDeviceTokenRequest
{
    public string Token { get; set; } = string.Empty;
    public string? Platform { get; set; }
    public string? DeviceType { get; set; }
    public string? RegisteredAt { get; set; }
}
