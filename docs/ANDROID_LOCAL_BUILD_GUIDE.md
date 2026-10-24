# Android Build & Update Guide (Local Zero-EAS-Cost)

## 1. Quick Update (JS/UI/Page Changes) - Takes 1 to 2 Minutes
Pehli baar build me 30-40 minute lagte hain kyunki C++ libraries compile hoti hain. Ab sab cached hai. Sirf JS update karke direct phone me install karne ke liye:

```powershell
$env:JAVA_HOME="C:\Program Files\Microsoft\jdk-17.0.20.101-hotspot"
$env:ANDROID_HOME="C:\Android\Sdk"
$env:PATH="$env:JAVA_HOME\bin;$env:ANDROID_HOME\platform-tools;$env:PATH"

cd android
.\gradlew.bat installRelease
cd ..
```
*Phone USB se connected hona chahiye.*

---

## 2. Generate Standalone APK (Client Ko Send Karne Ke Liye) - Takes ~2 Minutes
Nayi APK file banane ke liye:

```powershell
$env:JAVA_HOME="C:\Program Files\Microsoft\jdk-17.0.20.101-hotspot"
$env:ANDROID_HOME="C:\Android\Sdk"
$env:PATH="$env:JAVA_HOME\bin;$env:ANDROID_HOME\platform-tools;$env:PATH"

cd android
.\gradlew.bat assembleRelease
cd ..
```

**Output APK Path:**
`android\app\build\outputs\apk\release\app-release.apk`

---

## 3. Play Store / Production Build (AAB Format) - Size: ~25 MB to 35 MB
Play Store par APK upload nahi hoti, waha **Android App Bundle (.aab)** upload hoti hai.

```powershell
$env:JAVA_HOME="C:\Program Files\Microsoft\jdk-17.0.20.101-hotspot"
$env:ANDROID_HOME="C:\Android\Sdk"
$env:PATH="$env:JAVA_HOME\bin;$env:ANDROID_HOME\platform-tools;$env:PATH"

cd android
.\gradlew.bat bundleRelease
cd ..
```

**Output AAB Path:**
`android\app\build\outputs\bundle\release\app-release.aab`

---

## 4. App Restart / Reload on Phone (Bina Dobara Build Kiye)
Phone par chal rahe app ko close karke turant fresh reopen/reload karne ke liye:

```powershell
adb shell am force-stop com.superapp.v2
adb shell am start -n com.superapp.v2/.MainActivity
```

---

## 5. Size Clarification (APK vs Play Store)
- **Kyu abhi APK 168 MB ki hai?**
  Ye "FAT APK" (Universal APK) hai jisme 4 alag-alag CPU architecture ka code ek sath hai (`arm64-v8a`, `armeabi-v7a`, `x86`, `x86_64`) taaki har mobile me chal sake.
- **Play Store par kitni size dikhegi?**
  Play Store par sirf **25 MB se 35 MB** dikhegi. Google Play user ke device ke hisab se split karke sirf wahi binary bhejta hai jo uske phone ke liye chahiye hoti hai.
