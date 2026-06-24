# 📱 Руководство по компиляции Standalone-приложения в Android Studio

Этот будильник полностью подготовлен для сборки в качестве нативного Android-приложения с помощью **Capacitor**. В нативном приложении отсутствуют ограничения веб-браузеров на воспроизведение звука (Autoplay Restrictions), и будильник будет срабатывать **сразу и громко без необходимости кликать на экран**.

---

## 🛠️ Шаг 1. Локальная подготовка проекта на ПК

Для сборки на вашем компьютере должны быть установлены:
1. **Node.js** (LTS-версия).
2. **Android Studio** (последняя версия).

Скачайте архив вашего проекта, распакуйте его в удобную папку и откройте терминал в корневой папке проекта.

### 1. Установите зависимости и соберите веб-версию:
```bash
npm install
npm run build
```

### 2. Инициализируйте нативную Android-платформу:
```bash
# Добавляет файлы Android-проекта
npm run cap:add-android
```

---

## 🔊 Шаг 2. Как убрать необходимость клика для воспроизведения звуков

Чтобы нативный WebView в Android воспроизводил звук будильника автоматически и сразу, нам нужно отключить жест-активацию.

1. Перейдите в папку вашего Android-проекта:
   `android/app/src/main/java/com/minimalist/alarmclock/MainActivity.java` (или `MainActivity.kt`).
2. Измените код файла, настроив WebView так, чтобы он не требовал пользовательских жестов для медиа.

### Шаблон кода для `MainActivity.java`:

```java
package com.minimalist.alarmclock;

import android.os.Bundle;
import android.webkit.WebSettings;
import android.webkit.WebView;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
    }

    @Override
    public void onStart() {
        super.onStart();
        // Отключаем обязательное требование кликов для воспроизведения звуков
        WebView webView = this.getBridge().getWebView();
        if (webView != null) {
            WebSettings settings = webView.getSettings();
            settings.setMediaPlaybackRequiresUserGesture(false);
        }
    }
}
```

---

## 🚀 Шаг 3. Запуск и Компиляция в Android Studio

### 1. Синхронизируйте веб-сборку с нативным проектом:
Выполняйте эту команду каждый раз, когда вносите изменения в код React:
```bash
npm run build
npm run cap:sync
```

### 2. Откройте проект в Android Studio:
```bash
npm run cap:open-android
```
*(Или просто откройте папку `android/` непосредственно внутри программы Android Studio).*

---

## ✍️ Шаг 4. Подписание приложения (Signing & Subscription)

Чтобы установить приложение на любое устройство или опубликовать его, вы должны подписать его собственным цифровым ключом (Keystore).

1. В Android Studio в верхнем меню выберите:
   `Build` -> `Generate Signed Bundle / APK...`
2. Выберите **APK** (для ручной установки на устройства) или **Android App Bundle** (для публикации в Google Play).
3. Создайте новый ключ:
   - Нажмите **Create new...** под разделом Key store path.
   - Заполните форму (путь к файлу ключа `.jks`, пароли, ваше имя). Запомните эти данные!
4. Выберите тип сборки: **release**.
5. Нажмите **Finish**. Подписанный нативный файл будет скомпилирован в папку:
   `android/app/release/app-release.apk`

Вы можете скинуть этот APK на любой Android-телефон и установить его напрямую! Он будет работать автономно, громко и запускаться как обычное приложение с иконкой.
