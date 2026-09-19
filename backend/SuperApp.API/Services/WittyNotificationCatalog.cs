namespace SuperApp.API.Services;

public static class WittyNotificationCatalog
{
    public static readonly (string Title, string Body)[] LateNightFoodLines = new[]
    {
        ("Raat ko biwi wo de ya na de... 🍕", "Par hum khana dene zaroor aayenge! 😋 Garma-garam khana order karo, dil khush ho jayega!"),
        ("Bhookh lagi hai kya? 🌙🍔", "Kitchen band ho chuka hai, par humara dil aur delivery dono 24/7 khule hain!"),
        ("Dil toota ho ya neend udh gayi ho... 💔🍕", "Ek slice pizza sab theek kar deta hai! Abhi order karein!"),
        ("Khali pet dimaag ki batti nahi jalti! 💡", "Tadkedaar biryani mangwa lo, saara stress gayab ho jayega!"),
        ("Akele-akele kya reel dekh rahe ho? 📱🍿", "Kuch meetha ya chatpata mangwa lo, raat suhani ho jayegi!")
    };

    public static readonly (string Title, string Body)[] OrderStatusLines = new[]
    {
        ("Chef ne tadka laga diya hai! 🔥", "Aapka order kitchen me tezi se ban raha hai. Bas plate taiyaar rakho!"),
        ("Khana nikal chuka hai! 🛵💨", "Aapka delivery partner hawa se baatein karte hue aa raha hai. Bas 5 minute!"),
        ("Dastak ho chuki hai! 🚪😋", "Garma-garam khana darwaze par hai. Pet bhar ke khao, calories kal gin lena!")
    };

    public static readonly (string Title, string Body)[] RideLines = new[]
    {
        ("Ghar baith ke kya karoge? 🚖✨", "Chalo ghoomne! Gaadi darwaze pe khadi hai, seatbelt baandho!"),
        ("Captain aa gaya hai! 🛵💨", "Swag se baitho aur safar ka maza lo. Safety humari priority hai!"),
        ("Manzil aa gayi dost! 🏁⭐", "Safar kaisa raha? 5-star rating deke captain ka din bana do!")
    };

    public static readonly (string Title, string Body)[] SellerLines = new[]
    {
        ("Dhamaka! 🎉 Aapka Ad Live ho gaya!", "Puraani cheezon ko kaho bye-bye, jeb me aayegi nayi kamai! 💰📦"),
        ("Bazaar me dhoom machi hai! 👀🔥", "Naye buyers aapke product ko dekh rahe hain. Phone ki ghanti bajne wali hai!"),
        ("Item Listed Successfully! 🚀", "Aapka listing Community Bazaar me top par dikh raha hai!")
    };

    public static (string Title, string Body) GetRandomLateNightLine()
    {
        return LateNightFoodLines[Random.Shared.Next(LateNightFoodLines.Length)];
    }

    public static (string Title, string Body) GetRandomRideLine()
    {
        return RideLines[Random.Shared.Next(RideLines.Length)];
    }

    public static (string Title, string Body) GetRandomSellerLine()
    {
        return SellerLines[Random.Shared.Next(SellerLines.Length)];
    }
}
