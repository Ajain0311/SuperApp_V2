using System.Security.Cryptography;
using System.Text;

namespace SuperApp.API.Services;

public static class EasebuzzHash
{
    public static string Sha512Hex(string value)
    {
        var bytes = SHA512.HashData(Encoding.UTF8.GetBytes(value));
        return Convert.ToHexString(bytes).ToLowerInvariant();
    }

    /// <summary>
    /// Initiate Payment hash:
    /// key|txnid|amount|productinfo|firstname|email|udf1|udf2|udf3|udf4|udf5|udf6|udf7|udf8|udf9|udf10|salt
    /// </summary>
    public static string InitiatePayment(
        string key,
        string txnid,
        string amount,
        string productinfo,
        string firstname,
        string email,
        string udf1,
        string udf2,
        string udf3,
        string udf4,
        string udf5,
        string salt)
    {
        var raw =
            $"{key}|{txnid}|{amount}|{productinfo}|{firstname}|{email}|{udf1}|{udf2}|{udf3}|{udf4}|{udf5}||||||{salt}";
        return Sha512Hex(raw);
    }

    /// <summary>Transaction status hash: key|txnid|salt</summary>
    public static string TransactionStatus(string key, string txnid, string salt)
        => Sha512Hex($"{key}|{txnid}|{salt}");

    /// <summary>
    /// Callback / webhook reverse hash:
    /// salt|status|udf10|...|udf1|email|firstname|productinfo|amount|txnid|key
    /// </summary>
    public static string Reverse(
        string salt,
        string status,
        string udf10,
        string udf9,
        string udf8,
        string udf7,
        string udf6,
        string udf5,
        string udf4,
        string udf3,
        string udf2,
        string udf1,
        string email,
        string firstname,
        string productinfo,
        string amount,
        string txnid,
        string key)
    {
        var raw =
            $"{salt}|{status}|{udf10}|{udf9}|{udf8}|{udf7}|{udf6}|{udf5}|{udf4}|{udf3}|{udf2}|{udf1}|{email}|{firstname}|{productinfo}|{amount}|{txnid}|{key}";
        return Sha512Hex(raw);
    }
}
